import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { cookieName } from "./auth.config";
import { AuthRequest, Permission, permissionsFor } from "./auth.types";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>("public", [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const cookies = (request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.startsWith(`${cookieName()}=`));
    const token =
      cookies.length === 1 ? cookies[0].slice(cookieName().length + 1) : "";
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException("Vui lòng đăng nhập để tiếp tục.");
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: createHash("sha256").update(token).digest("hex") },
      include: { user: { include: { roles: true } } },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.isActive)
      throw new UnauthorizedException(
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      );
    const { user } = session;
    const roles = user.roles.map((item) => item.role);
    request.authUser = {
      id: user.id,
      departmentId: user.departmentId,
      email: user.email,
      fullName: user.fullName,
      roles,
      permissions: permissionsFor(roles),
      mustChangePassword: user.mustChangePassword,
    };
    const selectedRole = request.headers["x-workspace-role"];
    if (selectedRole && !request.url.startsWith("/api/auth/")) {
      if (
        typeof selectedRole !== "string" ||
        !roles.some((role) => role === selectedRole)
      )
        throw new ForbiddenException("Vai trò không được cấp cho tài khoản.");
      request.authUser.roles = roles.filter((role) => role === selectedRole);
      request.authUser.permissions = permissionsFor(request.authUser.roles);
    }
    request.sessionId = session.id;
    if (
      user.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>("allowPasswordChangePending", [
        context.getHandler(),
        context.getClass(),
      ])
    )
      throw new ForbiddenException({
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Bạn cần đổi mật khẩu tạm trước khi sử dụng hệ thống.",
      });
    const permission = this.reflector.getAllAndOverride<Permission>(
      "permission",
      [context.getHandler(), context.getClass()],
    );
    if (permission && !request.authUser.permissions.includes(permission))
      throw new ForbiddenException(
        "Bạn không có quyền thực hiện thao tác này.",
      );
    return true;
  }
}
