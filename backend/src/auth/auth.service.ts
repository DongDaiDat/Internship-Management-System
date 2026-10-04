import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword, verifyPassword } from "./password";
import { SESSION_DURATION_MS } from "./auth.config";
import { AuthUser, permissionsFor } from "./auth.types";

@Injectable()
export class AuthService {
  private readonly dummyHash = hashPassword(randomBytes(32).toString("hex"));
  constructor(private readonly prisma: PrismaService) {}

  private async throttle(key: string, limit: number): Promise<void> {
    const digest = createHash("sha256").update(key).digest("hex");
    // Atomic upsert keeps concurrent requests from bypassing the counter.
    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "LoginThrottle" ("key", "count", "expiresAt")
      VALUES (${digest}, 1, NOW() + INTERVAL '15 minutes')
      ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "LoginThrottle"."expiresAt" <= NOW() THEN 1 ELSE "LoginThrottle"."count" + 1 END,
      "expiresAt" = CASE WHEN "LoginThrottle"."expiresAt" <= NOW() THEN NOW() + INTERVAL '15 minutes' ELSE "LoginThrottle"."expiresAt" END
      RETURNING "count"`;
    if (rows[0].count > limit)
      throw new HttpException(
        "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }

  async login(
    email: string,
    password: string,
    ip: string,
  ): Promise<{ token: string; user: AuthUser }> {
    await this.throttle(`ip:${ip}`, 100);
    await this.throttle(`email:${email}`, 10);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });
    const valid = await verifyPassword(
      password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!valid || !user?.isActive)
      throw new UnauthorizedException("Email hoặc mật khẩu không đúng.");
    const token = randomBytes(32).toString("hex");
    await this.prisma.$transaction(async (tx) => {
      // Serialize session creation with password changes to prevent stale logins.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (!current?.isActive || current.passwordHash !== user.passwordHash)
        throw new UnauthorizedException("Email hoặc mật khẩu không đúng.");
      await tx.session.deleteMany({
        where: { userId: user.id, expiresAt: { lte: new Date() } },
      });
      await tx.session.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
        },
      });
      await tx.auditLog.create({
        data: { actorId: user.id, action: "auth.login", targetId: user.id },
      });
    });
    const roles = user.roles.map((item) => item.role);
    return {
      token,
      user: {
        id: user.id,
        departmentId: user.departmentId,
        email: user.email,
        fullName: user.fullName,
        roles,
        permissions: permissionsFor(roles),
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async logout(sessionId: string, actorId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({
        where: { id: sessionId, userId: actorId },
      });
      await tx.auditLog.create({
        data: { actorId, action: "auth.logout", targetId: actorId },
      });
    });
  }

  async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    password: string,
  ): Promise<void> {
    await this.throttle(`password-change:${userId}`, 10);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user?.isActive ||
      !(await verifyPassword(currentPassword, user.passwordHash))
    )
      throw new BadRequestException("Mật khẩu hiện tại không đúng.");
    if (currentPassword === password)
      throw new BadRequestException(
        "Mật khẩu mới phải khác mật khẩu hiện tại.",
      );
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const session = await tx.session.findFirst({
        where: { id: sessionId, userId, expiresAt: { gt: new Date() } },
      });
      if (!session) throw new UnauthorizedException("Vui lòng đăng nhập lại.");
      const updated = await tx.user.updateMany({
        where: { id: userId, isActive: true, passwordHash: user.passwordHash },
        data: { passwordHash, mustChangePassword: false },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Thông tin tài khoản đã thay đổi. Vui lòng đăng nhập lại.",
        );
      await tx.session.deleteMany({
        where: { userId, id: { not: sessionId } },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "auth.password_change",
          targetId: userId,
        },
      });
    });
  }
}
