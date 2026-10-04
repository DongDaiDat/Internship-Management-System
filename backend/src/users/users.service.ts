import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password";
import { CreateUserDto, ListUsersDto } from "./users.dto";
import { temporaryPassword } from "../auth/temporary-password";

const publicFields = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
  createdAt: true,
  departmentId: true,
  department: true,
  mustChangePassword: true,
  roles: { select: { role: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  async list(query: ListUsersDto) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { fullName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: publicFields,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map((user) => ({
        ...user,
        roles: user.roles.map((item) => item.role),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async create(dto: CreateUserDto, actorId: string) {
    if (
      dto.roles.some((r) =>
        ["FacultyManager", "InternshipCoordinator", "FacultyMentor"].includes(
          r,
        ),
      ) &&
      !dto.departmentId
    )
      throw new BadRequestException("Cần chọn khoa cho cán bộ.");
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            fullName: dto.fullName,
            passwordHash,
            departmentId: dto.departmentId,
            mustChangePassword: true,
            roles: { create: dto.roles.map((role) => ({ role })) },
          },
          select: publicFields,
        });
        await tx.auditLog.create({
          data: { actorId, action: "users.create", targetId: user.id },
        });
        return {
          ...user,
          roles: user.roles.map((item) => item.role),
          temporaryPassword: password,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException("Email này đã được sử dụng.");
      throw error;
    }
  }

  async resetPassword(id: string, actorId: string) {
    if (id === actorId)
      throw new BadRequestException(
        "Dùng chức năng đổi mật khẩu cho tài khoản đang đăng nhập.",
      );
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const record = await tx.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
        select: publicFields,
      });
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.auditLog.create({
        data: { actorId, action: "users.password_reset", targetId: id },
      });
      return record;
    });
    return {
      ...user,
      roles: user.roles.map((r) => r.role),
      temporaryPassword: password,
    };
  }

  async updateAccess(
    id: string,
    dto: { roles: import("@prisma/client").Role[]; departmentId?: string },
    actorId: string,
  ) {
    if (id === actorId)
      throw new BadRequestException(
        "Không tự thay đổi quyền của tài khoản đang sử dụng.",
      );
    if (
      dto.roles.some((r) =>
        ["FacultyManager", "InternshipCoordinator", "FacultyMentor"].includes(
          r,
        ),
      ) &&
      !dto.departmentId
    )
      throw new BadRequestException("Cần chọn khoa cho cán bộ.");
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUniqueOrThrow({ where: { id } });
      if (
        current.departmentId !== dto.departmentId &&
        (await tx.internshipPeriod.count({
          where: { coordinatorId: id, status: { not: "Closed" } },
        }))
      )
        throw new BadRequestException(
          "Chuyển các đợt đang phụ trách trước khi đổi khoa.",
        );
      if (
        !dto.roles.includes("InternshipCoordinator") &&
        (await tx.internshipPeriod.count({
          where: { coordinatorId: id, status: { not: "Closed" } },
        }))
      )
        throw new BadRequestException(
          "Chuyển các đợt đang phụ trách trước khi bỏ vai trò điều phối.",
        );
      await tx.userRole.deleteMany({ where: { userId: id } });
      const user = await tx.user.update({
        where: { id },
        data: {
          departmentId: dto.departmentId ?? null,
          roles: { create: dto.roles.map((role) => ({ role })) },
        },
        select: publicFields,
      });
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.auditLog.create({
        data: { actorId, action: "users.access_update", targetId: id },
      });
      return { ...user, roles: user.roles.map((r) => r.role) };
    });
  }

  async pending(query: {
    departmentId?: string;
    type?: string;
    importBatchId?: string;
  }) {
    const where = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.importBatchId ? { importBatchId: query.importBatchId } : {}),
    };
    const [students, faculty, companies] = await Promise.all([
      !query.type || query.type === "student"
        ? this.prisma.studentProfile.findMany({
            where: { ...where, userId: null },
            include: { department: true },
            orderBy: { fullName: "asc" },
          })
        : [],
      !query.type || query.type === "faculty"
        ? this.prisma.facultyProfile.findMany({
            where: { ...where, userId: null },
            include: { department: true },
            orderBy: { fullName: "asc" },
          })
        : [],
      !query.type || query.type === "company"
        ? this.prisma.companyProfile.findMany({
            where: { ...where, representativeUserId: null },
            include: { department: true },
            orderBy: { name: "asc" },
          })
        : [],
    ]);
    return [
      ...students.map((s) => ({
        id: s.id,
        type: "student",
        fullName: s.fullName,
        email: s.email,
        department: s.department,
        importBatchId: s.importBatchId,
        ready:
          !!s.departmentId &&
          !!s.majorId &&
          !!s.programId &&
          !!s.cohortId &&
          s.isVerified,
      })),
      ...faculty.map((s) => ({
        id: s.id,
        type: "faculty",
        fullName: s.fullName,
        email: s.email,
        department: s.department,
        importBatchId: s.importBatchId,
        ready: !!s.departmentId && s.isActive,
      })),
      ...companies.map((s) => ({
        id: s.id,
        type: "company",
        fullName: s.contactName,
        email: s.contactEmail,
        department: s.department,
        importBatchId: s.importBatchId,
        ready: !!s.departmentId && s.isVerified,
      })),
    ];
  }

  async provision(items: { id: string; type: string }[], actorId: string) {
    const results: {
      id: string;
      type: string;
      status: string;
      fullName?: string;
      email?: string;
      temporaryPassword?: string;
      reason?: string;
    }[] = [];
    for (const item of items) {
      try {
        const password = temporaryPassword();
        const passwordHash = await hashPassword(password);
        const result = await this.prisma.$transaction(async (tx) => {
          const table = {
            student: "StudentProfile",
            faculty: "FacultyProfile",
            company: "CompanyProfile",
          }[item.type];
          if (!table) throw new BadRequestException("Loại hồ sơ không hợp lệ.");
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM ${Prisma.raw('"' + table + '"')} WHERE "id" = ${item.id}::uuid FOR UPDATE`,
          );
          const s =
            item.type === "student"
              ? await tx.studentProfile.findUnique({ where: { id: item.id } })
              : null;
          const f =
            item.type === "faculty"
              ? await tx.facultyProfile.findUnique({ where: { id: item.id } })
              : null;
          const c =
            item.type === "company"
              ? await tx.companyProfile.findUnique({ where: { id: item.id } })
              : null;
          const profile = s || f || c;
          if (!profile) throw new BadRequestException("Không tìm thấy hồ sơ.");
          if (s?.userId || f?.userId || c?.representativeUserId)
            return { ...item, status: "skipped", reason: "Đã có tài khoản." };
          if (
            !profile.departmentId ||
            (s &&
              (!s.isVerified || !s.programId || !s.majorId || !s.cohortId)) ||
            (f && !f.isActive) ||
            (c && !c.isVerified)
          )
            throw new BadRequestException(
              "Hồ sơ cần được hoàn thiện và xác minh.",
            );
          const fullName = s?.fullName ?? f?.fullName ?? c!.contactName;
          const email = s?.email ?? f?.email ?? c!.contactEmail;
          const role = s ? "Student" : f ? "FacultyMentor" : "Company";
          const account = await tx.user.create({
            data: {
              fullName,
              email,
              departmentId: profile.departmentId,
              passwordHash,
              mustChangePassword: true,
              roles: { create: { role } },
            },
          });
          if (s)
            await tx.studentProfile.update({
              where: { id: s.id },
              data: { userId: account.id },
            });
          if (f)
            await tx.facultyProfile.update({
              where: { id: f.id },
              data: { userId: account.id },
            });
          if (c)
            await tx.companyProfile.update({
              where: { id: c.id },
              data: { representativeUserId: account.id },
            });
          await tx.auditLog.create({
            data: {
              actorId,
              action: "users.provision",
              targetId: account.id,
              details: { profileId: item.id, type: item.type },
            },
          });
          return {
            ...item,
            status: "created",
            fullName,
            email,
            roles: [role],
            temporaryPassword: password,
          };
        });
        results.push(result);
      } catch (error) {
        results.push({
          ...item,
          status: "failed",
          reason:
            error instanceof BadRequestException
              ? error.message
              : error instanceof Prisma.PrismaClientKnownRequestError &&
                  error.code === "P2002"
                ? "Email đã được dùng bởi tài khoản khác."
                : "Không thể cấp tài khoản. Vui lòng thử lại.",
        });
      }
    }
    return {
      results,
      created: results.filter((r) => r.status === "created").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
    };
  }

  async summary() {
    const [accounts, pending, departments, periods] = await Promise.all([
      this.prisma.user.count(),
      this.pending({}),
      this.prisma.department.count(),
      this.prisma.internshipPeriod.count({ where: { departmentId: null } }),
    ]);
    return {
      accounts,
      pending: pending.length,
      departments,
      incompletePeriods: periods,
    };
  }

  async unassigned() {
    const [students, faculty, companies, periods] = await Promise.all([
      this.prisma.studentProfile.findMany({
        where: { departmentId: null },
        select: { id: true, fullName: true },
      }),
      this.prisma.facultyProfile.findMany({
        where: { departmentId: null },
        select: { id: true, fullName: true },
      }),
      this.prisma.companyProfile.findMany({
        where: { departmentId: null },
        select: { id: true, name: true },
      }),
      this.prisma.internshipPeriod.findMany({
        where: { departmentId: null },
        select: { id: true, name: true },
      }),
    ]);
    return [
      ...students.map((x) => ({ ...x, type: "student" })),
      ...faculty.map((x) => ({ ...x, type: "faculty" })),
      ...companies.map((x) => ({
        id: x.id,
        fullName: x.name,
        type: "company",
      })),
      ...periods.map((x) => ({ id: x.id, fullName: x.name, type: "period" })),
    ];
  }
  async assignLegacy(
    type: string,
    id: string,
    departmentId: string,
    actorId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const where = { id, departmentId: null };
      const data = { departmentId };
      const result =
        type === "student"
          ? await tx.studentProfile.updateMany({ where, data })
          : type === "faculty"
            ? await tx.facultyProfile.updateMany({ where, data })
            : type === "company"
              ? await tx.companyProfile.updateMany({ where, data })
              : type === "period"
                ? await tx.internshipPeriod.updateMany({ where, data })
                : null;
      if (!result?.count)
        throw new BadRequestException(
          "Chỉ được phân khoa cho bản ghi cũ chưa có khoa.",
        );
      await tx.auditLog.create({
        data: {
          actorId,
          action: "legacy.department_assign",
          targetId: id,
          details: { type, departmentId },
        },
      });
      return { assigned: true };
    });
  }
}
