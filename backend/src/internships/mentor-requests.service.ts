import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../auth/auth.types";
import {
  academicInclude,
  matchesAudience,
  periodInclude,
} from "./academic.service";
import {
  MentorRequestDto,
  MentorRequestQueryDto,
  MentorResponseDto,
} from "./mentor-requests.dto";

export const mentorHistory = {
  include: { facultyMentor: { select: { id: true, fullName: true } } },
  orderBy: [{ createdAt: "desc" }, { id: "asc" }],
} satisfies Prisma.MentorRequestFindManyArgs;
export const activeMentorAccount = {
  isActive: true,
  roles: { some: { role: Role.FacultyMentor } },
};
export const mentorLoadWhere = (
  excludeId?: string,
): Prisma.InternshipWhereInput => ({
  endsAt: { gte: new Date() },
  ...(excludeId ? { id: { not: excludeId } } : {}),
});

@Injectable()
export class MentorRequestsService {
  constructor(private readonly db: PrismaService) {}
  private role(user: AuthUser, role: Role) {
    if (!user.roles.includes(role))
      throw new ForbiddenException(
        "Bạn không có quyền thực hiện thao tác này.",
      );
  }
  async lock(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "InternshipApplication" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }
  async close(
    tx: Prisma.TransactionClient,
    applicationId: string,
    reason: string,
  ) {
    await tx.mentorRequest.updateMany({
      where: { applicationId, closedAt: null },
      data: { closedAt: new Date(), closeReason: reason },
    });
  }
  async eligible(
    tx: Prisma.TransactionClient,
    id: string,
    departmentId: string | null,
    excludeId?: string,
  ) {
    const mentor = await tx.facultyProfile.findFirst({
      where: { id, departmentId, isActive: true, user: activeMentorAccount },
    });
    if (!departmentId || !mentor)
      throw new BadRequestException(
        "Giảng viên hoặc tài khoản không còn hợp lệ trong khoa.",
      );
    const count = await tx.internship.count({
      where: { facultyMentorId: id, ...mentorLoadWhere(excludeId) },
    });
    if (count >= mentor.maxStudents)
      throw new ConflictException("Giảng viên đã đủ giới hạn hướng dẫn.");
    return mentor;
  }
  async choices(periodId: string, user: AuthUser) {
    this.role(user, Role.Student);
    const student = await this.db.studentProfile.findUnique({
      where: { userId: user.id },
      include: academicInclude,
    });
    const period = await this.db.internshipPeriod.findUnique({
      where: { id: periodId },
      include: periodInclude,
    });
    if (
      !student ||
      !period ||
      period.status !== "Published" ||
      !matchesAudience(student, period)
    )
      throw new ForbiddenException("Đợt không thuộc phạm vi đăng ký của bạn.");
    const list = await this.db.facultyProfile.findMany({
      where: {
        departmentId: period.departmentId,
        isActive: true,
        user: activeMentorAccount,
      },
      select: {
        id: true,
        fullName: true,
        expertise: true,
        maxStudents: true,
        _count: {
          select: { supervisedInternships: { where: mentorLoadWhere() } },
        },
      },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    });
    return list.map(({ _count, ...f }) => ({
      ...f,
      assignedCount: _count.supervisedInternships,
      available: _count.supervisedInternships < f.maxStudents,
    }));
  }
  async create(
    tx: Prisma.TransactionClient,
    applicationId: string,
    departmentId: string | null,
    dto: MentorRequestDto,
    actorId: string,
  ) {
    await this.eligible(tx, dto.facultyMentorId, departmentId);
    const request = await tx.mentorRequest.create({
      data: { applicationId, ...dto },
    });
    await tx.auditLog.create({
      data: { actorId, action: "mentor_request.submit", targetId: request.id },
    });
    return request;
  }
  async set(
    applicationId: string,
    dto: MentorRequestDto | null,
    user: AuthUser,
  ) {
    this.role(user, Role.Student);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, applicationId);
      const a = await tx.internshipApplication.findFirst({
        where: { id: applicationId, student: { userId: user.id } },
        include: {
          period: { include: periodInclude },
          student: { include: academicInclude },
        },
      });
      if (!a) throw new NotFoundException("Không tìm thấy hồ sơ.");
      const now = new Date();
      if (
        !["Submitted", "NeedsRevision"].includes(a.status) ||
        a.period.status !== "Published" ||
        now < a.period.registrationStartsAt ||
        now > a.period.registrationEndsAt
      )
        throw new ConflictException(
          "Chỉ thay đổi đề xuất khi hồ sơ chờ xử lý và còn hạn đăng ký.",
        );
      if (!matchesAudience(a.student, a.period))
        throw new ForbiddenException(
          "Hồ sơ không còn thuộc đối tượng của đợt.",
        );
      const previous = await tx.mentorRequest.findFirst({
        where: { applicationId, closedAt: null },
      });
      if (
        dto &&
        previous?.facultyMentorId === dto.facultyMentorId &&
        previous.reason === dto.reason
      )
        return previous;
      await this.close(tx, applicationId, dto ? "Replaced" : "Withdrawn");
      if (dto)
        return this.create(
          tx,
          applicationId,
          a.period.departmentId,
          dto,
          user.id,
        );
      if (previous)
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "mentor_request.withdraw",
            targetId: previous.id,
          },
        });
      return null;
    });
  }
  async list(query: MentorRequestQueryDto, user: AuthUser) {
    this.role(user, Role.FacultyMentor);
    const mentor = await this.db.facultyProfile.findFirst({
      where: { userId: user.id, isActive: true, user: activeMentorAccount },
    });
    if (!mentor?.departmentId)
      throw new ForbiddenException("Hồ sơ giảng viên chưa hợp lệ.");
    const scope: Prisma.MentorRequestWhereInput = {
      facultyMentorId: mentor.id,
      application: { period: { departmentId: mentor.departmentId } },
    };
    const actionable: Prisma.MentorRequestWhereInput = {
      ...scope,
      closedAt: null,
      response: "Pending",
      application: {
        status: "Submitted",
        period: {
          departmentId: mentor.departmentId,
          status: "Published",
          endsAt: { gt: new Date() },
        },
      },
    };
    const where: Prisma.MentorRequestWhereInput = {
      AND: [
        scope,
        ...(query.requestId ? [{ id: query.requestId }] : []),
        ...(query.periodId
          ? [{ application: { periodId: query.periodId } }]
          : []),
        ...(query.status === "Closed"
          ? [{ closedAt: { not: null } }]
          : query.status
            ? [
                {
                  closedAt: null,
                  response: query.status as "Pending" | "Accepted" | "Declined",
                },
              ]
            : []),
        ...(query.search
          ? [
              {
                application: {
                  student: {
                    OR: [
                      {
                        fullName: {
                          contains: query.search,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        studentCode: {
                          contains: query.search,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  },
                },
              },
            ]
          : []),
      ],
    };
    const [items, total, pendingCount, periods, assignedCount] =
      await this.db.$transaction([
        this.db.mentorRequest.findMany({
          where,
          skip: (query.page - 1) * 20,
          take: 20,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          include: {
            application: {
              select: {
                id: true,
                status: true,
                positionTitle: true,
                externalCompanyName: true,
                company: { select: { name: true } },
                period: {
                  select: { id: true, name: true, status: true, endsAt: true },
                },
                student: {
                  select: {
                    fullName: true,
                    studentCode: true,
                    className: true,
                    completedCredits: true,
                    programCredits: true,
                    academicMajor: { select: { name: true } },
                    program: { select: { name: true } },
                    academicCohort: { select: { code: true } },
                  },
                },
              },
            },
          },
        }),
        this.db.mentorRequest.count({ where }),
        this.db.mentorRequest.count({ where: actionable }),
        this.db.internshipPeriod.findMany({
          where: {
            departmentId: mentor.departmentId,
            applications: {
              some: {
                mentorRequests: { some: { facultyMentorId: mentor.id } },
              },
            },
          },
          select: { id: true, name: true },
          orderBy: { createdAt: "desc" },
        }),
        this.db.internship.count({
          where: { facultyMentorId: mentor.id, ...mentorLoadWhere() },
        }),
      ]);
    return {
      items,
      total,
      pendingCount,
      periods,
      assignedCount,
      maxStudents: mentor.maxStudents,
      page: query.page,
    };
  }
  async respond(id: string, dto: MentorResponseDto, user: AuthUser) {
    this.role(user, Role.FacultyMentor);
    if (
      dto.response === "Declined" &&
      (!dto.note || dto.note.trim().length < 10)
    )
      throw new BadRequestException("Lý do từ chối cần 10–500 ký tự.");
    return this.db.$transaction(async (tx) => {
      const initial = await tx.mentorRequest.findUnique({ where: { id } });
      if (!initial) throw new NotFoundException("Không tìm thấy đề xuất.");
      await this.lock(tx, initial.applicationId);
      const r = await tx.mentorRequest.findUniqueOrThrow({
        where: { id },
        include: {
          facultyMentor: { include: { user: { include: { roles: true } } } },
          application: { include: { period: true } },
        },
      });
      if (
        r.facultyMentor.userId !== user.id ||
        !r.facultyMentor.isActive ||
        !r.facultyMentor.user?.isActive ||
        !r.facultyMentor.departmentId ||
        r.facultyMentor.departmentId !== r.application.period.departmentId
      )
        throw new ForbiddenException(
          "Đề xuất không thuộc phạm vi hướng dẫn của bạn.",
        );
      if (
        r.closedAt ||
        r.application.status !== "Submitted" ||
        r.application.period.status !== "Published" ||
        new Date() >= r.application.period.endsAt
      )
        throw new ConflictException("Đề xuất không còn chờ phản hồi.");
      if (r.response !== "Pending") {
        if (
          r.response === dto.response &&
          (r.responseNote ?? "") === (dto.note ?? "")
        )
          return tx.mentorRequest.findUniqueOrThrow({ where: { id } });
        throw new ConflictException("Đề xuất đã được phản hồi.");
      }
      const result = await tx.mentorRequest.update({
        where: { id },
        data: {
          response: dto.response,
          responseNote: dto.note,
          respondedAt: new Date(),
          respondedById: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "mentor_request.respond",
          targetId: id,
          reason: dto.note,
          details: { response: dto.response },
        },
      });
      return result;
    });
  }
}
