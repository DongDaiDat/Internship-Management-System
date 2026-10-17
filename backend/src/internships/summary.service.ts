import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import * as ExcelJS from "exceljs";
import { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { staffDepartment } from "./academic.service";
import { SummaryQueryDto } from "./summary.dto";

const include = {
  student: {
    include: {
      department: true,
      academicMajor: true,
      program: true,
      academicCohort: true,
    },
  },
  period: { include: { department: true } },
  company: true,
  facultyMentor: true,
  application: { select: { status: true } },
  finalGrade: true,
  facultyEvaluation: true,
  finalReport: { select: { score: true, mentorNote: true, gradedAt: true } },
  weeklyReports: {
    select: {
      weekNumber: true,
      status: true,
      reviewedAt: true,
      mentorNote: true,
    },
  },
  supervisorEvaluations: true,
  companySupervisorAssignments: {
    include: {
      supervisor: { include: { user: { select: { fullName: true } } } },
    },
  },
  assignmentHistory: { orderBy: { startedAt: "asc" as const } },
} satisfies Prisma.InternshipInclude;
type RecordData = Prisma.InternshipGetPayload<{ include: typeof include }>;
type Scope = {
  role: Role;
  where: Prisma.InternshipWhereInput;
  kind?: string;
  targetId?: string;
  staff: boolean;
};
const statusLabels: Record<string, string> = {
  upcoming: "Sắp diễn ra",
  active: "Đang thực tập",
  awaiting: "Chờ hoàn tất",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
};
export function internshipStatus(
  i: {
    application: { status: string };
    finalGrade: unknown;
    startsAt: Date;
    endsAt: Date;
  },
  now: Date,
) {
  if (i.application.status === "Cancelled") return "cancelled";
  if (i.finalGrade) return "completed";
  if (i.startsAt > now) return "upcoming";
  return i.endsAt >= now ? "active" : "awaiting";
}
const option = (id: string, name: string) => ({ id, name });

@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}
  async scope(user: AuthUser, currentOnly = false): Promise<Scope> {
    // A multi-role API caller must choose a workspace; never union scopes.
    if (user.roles.length !== 1)
      throw new ForbiddenException("Vui lòng chọn không gian làm việc.");
    const role = user.roles[0];
    if (role === Role.FacultyManager || role === Role.InternshipCoordinator) {
      if (!user.permissions.includes("reports:department"))
        throw new ForbiddenException();
      return {
        role,
        staff: true,
        where: {
          period: {
            departmentId: staffDepartment(user),
            ...(role === Role.InternshipCoordinator
              ? { coordinatorId: user.id }
              : {}),
          },
        },
      };
    }
    if (role === Role.Student && user.permissions.includes("reports:student"))
      return { role, staff: false, where: { student: { userId: user.id } } };
    let kind: string,
      targetId: string | undefined,
      current: Prisma.InternshipWhereInput;
    if (
      role === Role.FacultyMentor &&
      user.permissions.includes("reports:mentor")
    ) {
      const p = await this.prisma.facultyProfile.findUnique({
        where: { userId: user.id },
      });
      kind = "mentor";
      targetId = p?.id;
      current = { facultyMentorId: targetId };
    } else if (
      role === Role.Company &&
      user.permissions.includes("reports:company")
    ) {
      const p = await this.prisma.companyProfile.findUnique({
        where: { representativeUserId: user.id },
      });
      kind = "company";
      targetId = p?.id;
      current = { companyId: targetId };
    } else if (
      role === Role.CompanySupervisor &&
      user.permissions.includes("reports:company")
    ) {
      const p = await this.prisma.companySupervisorProfile.findUnique({
        where: { userId: user.id },
      });
      kind = "supervisor";
      targetId = p?.id;
      current = {
        companySupervisorAssignments: { some: { supervisorId: targetId } },
      };
    } else throw new ForbiddenException("Không có quyền xem dữ liệu thực tập.");
    if (!targetId)
      return { role, kind, staff: false, where: { id: { in: [] } } };
    return {
      role,
      staff: false,
      kind,
      targetId,
      where: currentOnly
        ? current
        : {
            OR: [current, { assignmentHistory: { some: { kind, targetId } } }],
          },
    };
  }
  private current(i: RecordData, scope: Scope) {
    return (
      !scope.kind ||
      (scope.kind === "mentor"
        ? i.facultyMentorId === scope.targetId
        : scope.kind === "company"
          ? i.companyId === scope.targetId
          : i.companySupervisorAssignments.some(
              (a) => a.supervisorId === scope.targetId,
            ))
    );
  }
  private row(i: RecordData, scope: Scope, now: Date) {
    const isAssigned = this.current(i, scope);
    const isCurrent =
      isAssigned && !i.finalGrade && i.application.status !== "Cancelled";
    const canProgress =
      scope.staff ||
      scope.role === Role.Student ||
      (isAssigned && scope.kind === "mentor");
    const histories = i.assignmentHistory.filter(
      (h) =>
        !scope.kind || (h.kind === scope.kind && h.targetId === scope.targetId),
    );
    const companyHistory = !isAssigned
      ? i.assignmentHistory
          .filter(
            (h) =>
              h.kind === "company" &&
              histories.some((a) => a.companyId === h.targetId),
          )
          .at(-1)
      : undefined;
    const submitted = new Set(i.weeklyReports.map((r) => r.weekNumber));
    const missingReports =
      canProgress && !i.finalGrade
        ? i.period.weeklyDeadlines.filter(
            (d, n) => d < now && !submitted.has(n + 1),
          ).length
        : null;
    const pendingReviews =
      canProgress && !i.finalGrade
        ? i.weeklyReports.filter((r) => r.status === "Submitted").length
        : null;
    const ownEvaluations = i.supervisorEvaluations.filter(
      (e) => scope.kind !== "supervisor" || e.supervisorId === scope.targetId,
    );
    const canCompany =
      isAssigned &&
      (scope.staff ||
        scope.role === Role.Student ||
        scope.kind === "company" ||
        scope.kind === "supervisor");
    return {
      id: i.id,
      student: {
        id: i.student.id,
        fullName: i.student.fullName,
        studentCode: i.student.studentCode,
        email: i.student.email,
      },
      period: option(i.period.id, i.period.name),
      academicYear: i.period.academicYear,
      semester: i.period.semester,
      department:
        i.period.department &&
        option(i.period.department.id, i.period.department.name),
      major:
        i.student.academicMajor &&
        option(i.student.academicMajor.id, i.student.academicMajor.name),
      program:
        i.student.program &&
        option(i.student.program.id, i.student.program.name),
      cohort:
        i.student.academicCohort &&
        option(i.student.academicCohort.id, i.student.academicCohort.code),
      company: companyHistory
        ? option(companyHistory.targetId, companyHistory.targetName)
        : isAssigned && i.company
          ? option(i.company.id, i.company.name)
          : null,
      mentor: isAssigned
        ? option(i.facultyMentor.id, i.facultyMentor.fullName)
        : scope.kind === "mentor"
          ? option(
              scope.targetId!,
              histories.at(-1)?.targetName || "Giảng viên",
            )
          : null,
      supervisors: isAssigned
        ? i.companySupervisorAssignments
            .filter(
              (a) =>
                scope.kind !== "supervisor" ||
                a.supervisorId === scope.targetId,
            )
            .map((a) => option(a.supervisorId, a.supervisor.user.fullName))
        : [],
      status: internshipStatus(i, now),
      isCurrent,
      startsAt: i.startsAt,
      endsAt: i.endsAt,
      assignments: histories.map((h) => ({
        id: h.id,
        kind: h.kind,
        name: h.targetName,
        startedAt: h.startedAt,
        endedAt: h.endedAt,
        source: h.source,
      })),
      submittedReports: canProgress ? i.weeklyReports.length : null,
      expectedReports: canProgress ? i.period.weeklyReportCount : null,
      missingReports,
      pendingReviews,
      missingFaculty: canProgress
        ? !i.finalGrade && !i.facultyEvaluation
        : null,
      missingCompany:
        canCompany && !i.finalGrade
          ? scope.kind === "supervisor"
            ? ownEvaluations.length === 0
            : i.companySupervisorAssignments.length === 0 ||
              i.companySupervisorAssignments.some(
                (a) =>
                  !ownEvaluations.some(
                    (e) => e.supervisorId === a.supervisorId,
                  ),
              )
          : null,
      facultyScore:
        scope.staff ||
        (scope.role === Role.Student && !!i.finalGrade) ||
        (isAssigned && scope.kind === "mentor")
          ? (i.facultyEvaluation?.score ?? null)
          : null,
      companyScores:
        canCompany && (scope.role !== Role.Student || !!i.finalGrade)
          ? ownEvaluations.map((e) => ({
              score: e.total,
              note: e.evidenceNote,
            }))
          : [],
      finalGrade:
        scope.staff || scope.role === Role.Student
          ? i.finalGrade && {
              total: i.finalGrade.total,
              letterGrade: i.finalGrade.letterGrade,
              passed: i.finalGrade.passed,
            }
          : null,
    };
  }
  private async dataset(user: AuthUser, q: SummaryQueryDto) {
    const scope = await this.scope(user);
    const raw = await this.prisma.internship.findMany({
      where: scope.where,
      include,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    const now = new Date();
    const all = raw.map((i) => this.row(i, scope, now));
    const unique = (items: ({ id: string; name: string } | null)[]) =>
      [
        ...new Map(
          items.filter((x) => x !== null).map((x) => [x!.id, x!]),
        ).values(),
      ].sort((a, b) => a.name.localeCompare(b.name, "vi"));
    const options = {
      academicYear: [
        ...new Set(
          all.map((i) => i.academicYear).filter((x): x is string => !!x),
        ),
      ]
        .sort()
        .reverse()
        .map((y) => option(y, y)),
      periodId: unique(all.map((i) => i.period)),
      departmentId: unique(all.map((i) => i.department)),
      majorId: unique(all.map((i) => i.major)),
      programId: unique(all.map((i) => i.program)),
      cohortId: unique(all.map((i) => i.cohort)),
      companyId: unique(all.map((i) => i.company)),
      mentorId: unique(all.map((i) => i.mentor)),
      supervisorId: unique(all.flatMap((i) => i.supervisors)),
    };
    if (scope.role === Role.Student) {
      const applications = await this.prisma.internshipApplication.findMany({
        where: { student: { userId: user.id } },
        select: {
          period: { select: { id: true, name: true, academicYear: true } },
          company: { select: { id: true, name: true } },
        },
      });
      options.periodId = unique([
        ...options.periodId,
        ...applications.map((a) => option(a.period.id, a.period.name)),
      ]);
      options.academicYear = unique([
        ...options.academicYear,
        ...applications.flatMap((a) =>
          a.period.academicYear
            ? [option(a.period.academicYear, a.period.academicYear)]
            : [],
        ),
      ]).reverse();
      options.companyId = unique([
        ...options.companyId,
        ...applications.map((a) => a.company),
      ]);
    }
    const rows = all.filter((i) => {
      if (
        (q.academicYear && q.academicYear !== i.academicYear) ||
        (q.semester && q.semester !== i.semester) ||
        (q.status && q.status !== i.status)
      )
        return false;
      for (const [key, value] of Object.entries({
        periodId: i.period.id,
        departmentId: i.department?.id,
        majorId: i.major?.id,
        programId: i.program?.id,
        cohortId: i.cohort?.id,
        companyId: i.company?.id,
        mentorId: i.mentor?.id,
      }))
        if (
          q[key as keyof SummaryQueryDto] &&
          q[key as keyof SummaryQueryDto] !== value
        )
          return false;
      if (q.supervisorId && !i.supervisors.some((s) => s.id === q.supervisorId))
        return false;
      if (
        (q.assignment === "current" && !i.isCurrent) ||
        (q.assignment === "former" && i.isCurrent)
      )
        return false;
      if (
        q.search &&
        !`${i.student.fullName} ${i.student.studentCode} ${i.student.email}`
          .toLocaleLowerCase("vi")
          .includes(q.search.trim().toLocaleLowerCase("vi"))
      )
        return false;
      if (
        (q.attention === "missingReports" && !i.missingReports) ||
        (q.attention === "pendingReviews" && !i.pendingReviews) ||
        (q.attention === "missingFaculty" && !i.missingFaculty) ||
        (q.attention === "missingCompany" && !i.missingCompany) ||
        (q.attention === "unassignedSupervisor" &&
          (!i.isCurrent || i.supervisors.length)) ||
        (q.attention === "passed" && !i.finalGrade?.passed) ||
        (q.attention === "failed" && (!i.finalGrade || i.finalGrade.passed))
      )
        return false;
      return true;
    });
    if (q.sort === "oldest") rows.reverse();
    if (q.sort === "student")
      rows.sort(
        (a, b) =>
          a.student.fullName.localeCompare(b.student.fullName, "vi") ||
          a.id.localeCompare(b.id),
      );
    return { scope, rows, options };
  }
  async list(user: AuthUser, q: SummaryQueryDto) {
    const { rows, options } = await this.dataset(user, q);
    const page = q.page || 1,
      pageSize = q.pageSize || 20;
    const group = (key: "company" | "mentor") => {
      const counts = new Map<
        string,
        { id: string; name: string; total: number; active: number }
      >();
      for (const r of rows) {
        const entity = r[key];
        if (!entity) continue;
        const g = counts.get(entity.id) || { ...entity, total: 0, active: 0 };
        g.total++;
        if (r.status === "active" && r.isCurrent) g.active++;
        counts.set(entity.id, g);
      }
      return [...counts.values()].sort(
        (a, b) => b.total - a.total || a.name.localeCompare(b.name, "vi"),
      );
    };
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      studentCount: new Set(rows.map((r) => r.student.id)).size,
      page,
      pageSize,
      options,
      companies: group("company"),
      mentors: group("mentor"),
    };
  }
  async registrations(user: AuthUser, q: SummaryQueryDto) {
    const scope = await this.scope(user);
    if (scope.role !== Role.Student)
      throw new ForbiddenException(
        "Chỉ xem lịch sử đăng ký của chính sinh viên.",
      );
    const where: Prisma.InternshipApplicationWhereInput = {
      student: {
        userId: user.id,
        ...(q.majorId ? { majorId: q.majorId } : {}),
        ...(q.programId ? { programId: q.programId } : {}),
        ...(q.cohortId ? { cohortId: q.cohortId } : {}),
      },
      period: {
        ...(q.academicYear ? { academicYear: q.academicYear } : {}),
        ...(q.semester ? { semester: q.semester } : {}),
        ...(q.departmentId ? { departmentId: q.departmentId } : {}),
      },
      ...(q.periodId ? { periodId: q.periodId } : {}),
      ...(q.companyId ? { companyId: q.companyId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.internshipApplication.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          status: true,
          positionTitle: true,
          createdAt: true,
          reviewNote: true,
          period: {
            select: {
              id: true,
              name: true,
              academicYear: true,
              semester: true,
            },
          },
          company: { select: { name: true } },
          externalCompanyName: true,
        },
      }),
      this.prisma.internshipApplication.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
  async overview(user: AuthUser, q: SummaryQueryDto) {
    if (
      user.roles.length === 1 &&
      user.roles[0] === Role.Admin &&
      user.permissions.includes("reports:platform")
    )
      return this.platform();
    const { rows, scope } = await this.dataset(user, q);
    const metric = (
      key: string,
      label: string,
      value: number,
      query: string,
    ) => ({ key, label, value, query });
    const active = rows.filter(
      (r) => r.status === "active" && r.isCurrent,
    ).length;
    const completed = rows.filter((r) => r.status === "completed").length;
    const missing = rows.filter((r) => r.missingReports).length;
    let metrics = [
      metric(
        "active",
        "Đang thực tập",
        active,
        "status=active&assignment=current",
      ),
      metric("completed", "Đã hoàn thành", completed, "status=completed"),
    ];
    const tasks: { label: string; count: number; path: string }[] = [];
    if (scope.staff) {
      const period: Prisma.InternshipPeriodWhereInput = {
        AND: [
          {
            departmentId: staffDepartment(user),
            ...(scope.role === Role.InternshipCoordinator
              ? { coordinatorId: user.id }
              : {}),
          },
          {
            ...(q.periodId ? { id: q.periodId } : {}),
            ...(q.academicYear ? { academicYear: q.academicYear } : {}),
            ...(q.semester ? { semester: q.semester } : {}),
            ...(q.departmentId ? { departmentId: q.departmentId } : {}),
          },
        ],
      };
      const pending = await this.prisma.internshipApplication.count({
        where: { period, status: "Submitted" },
      });
      const exceptions = await this.prisma.eligibilityExceptionRequest.count({
        where: { status: "Pending", application: { period } },
      });
      const prefix =
        scope.role === Role.FacultyManager ? "faculty" : "coordinator";
      tasks.push({
        label: "Đăng ký chờ xử lý",
        count: pending,
        path: `/workspace/${prefix}/${scope.role === Role.FacultyManager ? "approvals" : "applications"}`,
      });
      if (scope.role === Role.FacultyManager)
        tasks.push({
          label: "Ngoại lệ học vụ",
          count: exceptions,
          path: "/workspace/faculty/exceptions",
        });
      metrics = [
        ...metrics,
        metric(
          "upcoming",
          "Sắp diễn ra",
          rows.filter((r) => r.status === "upcoming").length,
          "status=upcoming",
        ),
        metric(
          "awaiting",
          "Chờ hoàn tất",
          rows.filter((r) => r.status === "awaiting").length,
          "status=awaiting",
        ),
        metric(
          "missingReports",
          "Thiếu báo cáo quá hạn",
          missing,
          "attention=missingReports",
        ),
        metric(
          "missingEvaluation",
          scope.role === Role.FacultyManager
            ? "Chưa có điểm giảng viên"
            : "Thiếu đánh giá doanh nghiệp",
          rows.filter((r) =>
            scope.role === Role.FacultyManager
              ? r.missingFaculty
              : r.missingCompany,
          ).length,
          scope.role === Role.FacultyManager
            ? "attention=missingFaculty"
            : "attention=missingCompany",
        ),
      ];
    } else if (scope.kind === "mentor") {
      metrics.push(
        metric(
          "pendingReviews",
          "Có báo cáo chờ nhận xét",
          rows.filter((r) => r.pendingReviews).length,
          "attention=pendingReviews",
        ),
        metric(
          "missingFaculty",
          "Chưa đánh giá",
          rows.filter((r) => r.missingFaculty).length,
          "attention=missingFaculty",
        ),
      );
      const count = await this.prisma.mentorRequest.count({
        where: {
          facultyMentorId:
            scope.targetId || "00000000-0000-0000-0000-000000000000",
          response: "Pending",
          closedAt: null,
        },
      });
      tasks.push({
        label: "Đề xuất hướng dẫn chờ phản hồi",
        count,
        path: "/workspace/mentor/requests",
      });
    } else if (scope.kind === "company" || scope.kind === "supervisor") {
      metrics.push(
        metric(
          "missingCompany",
          "Chưa hoàn tất đánh giá",
          rows.filter((r) => r.missingCompany).length,
          "attention=missingCompany",
        ),
        metric(
          "former",
          "Phân công đã kết thúc",
          rows.filter((r) => !r.isCurrent).length,
          "assignment=former",
        ),
      );
      if (scope.kind === "company")
        metrics.push(
          metric(
            "unassignedSupervisor",
            "Chưa có người hướng dẫn",
            rows.filter((r) => r.isCurrent && !r.supervisors.length).length,
            "attention=unassignedSupervisor",
          ),
        );
    } else
      metrics.push(
        metric(
          "missingReports",
          "Thiếu báo cáo quá hạn",
          missing,
          "attention=missingReports",
        ),
        metric(
          "awaiting",
          "Chờ hoàn tất",
          rows.filter((r) => r.status === "awaiting").length,
          "status=awaiting",
        ),
      );
    return { metrics, tasks };
  }
  private async platform() {
    const [
      accounts,
      locked,
      students,
      faculty,
      companies,
      incomplete,
      staff,
      links,
      recent,
      incompleteStudents,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.studentProfile.count({ where: { userId: null } }),
      this.prisma.facultyProfile.count({ where: { userId: null } }),
      this.prisma.companyProfile.count({
        where: { representativeUserId: null },
      }),
      this.prisma.internshipPeriod.count({
        where: {
          OR: [
            { departmentId: null },
            { academicYear: null },
            { semester: null },
            { roundNumber: null },
          ],
        },
      }),
      this.prisma.user.count({
        where: {
          departmentId: null,
          roles: {
            some: {
              role: {
                in: [
                  Role.FacultyManager,
                  Role.InternshipCoordinator,
                  Role.FacultyMentor,
                ],
              },
            },
          },
        },
      }),
      this.prisma.departmentProgram.count({ where: { confirmed: false } }),
      this.prisma.auditLog.findMany({
        where: {
          action: {
            in: ["users.create", "users.password_reset", "users.provision"],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, action: true, createdAt: true },
      }),
      this.prisma.studentProfile.count({
        where: {
          OR: [
            { departmentId: null },
            { majorId: null },
            { programId: null },
            { cohortId: null },
          ],
        },
      }),
    ]);
    return {
      metrics: [
        ["accounts", "Tài khoản", accounts, "accounts"],
        ["locked", "Tài khoản bị khóa", locked, "accounts"],
        [
          "pending",
          "Chờ cấp tài khoản",
          students + faculty + companies,
          "pending",
        ],
        ["staff", "Cán bộ chưa có khoa", staff, "accounts"],
        ["links", "Liên kết cần xác nhận", links, "catalog"],
        ["incomplete", "Đợt thiếu thông tin", incomplete, "catalog"],
      ].map(([key, label, value, path]) => ({
        key,
        label,
        value,
        path: `/workspace/admin/${path}`,
      })),
      tasks: [
        {
          label: "Hồ sơ học vụ thiếu liên kết đào tạo",
          count: incompleteStudents,
          path: "/workspace/admin/catalog",
        },
      ],
      recent,
    };
  }
  async history(user: AuthUser, id: string) {
    const scope = await this.scope(user);
    const i = await this.prisma.internship.findFirst({
      where: { AND: [scope.where, { id }] },
      include,
    });
    if (!i)
      throw new NotFoundException(
        "Không tìm thấy hồ sơ trong phạm vi được xem.",
      );
    const histories = i.assignmentHistory.filter(
      (h) =>
        !scope.kind || (h.kind === scope.kind && h.targetId === scope.targetId),
    );
    return histories.map((h) => {
      let snapshot: unknown = h.snapshot;
      if (!h.endedAt) {
        snapshot =
          h.kind === "mentor"
            ? {
                facultyEvaluation: i.facultyEvaluation && {
                  score: i.facultyEvaluation.score,
                  note: i.facultyEvaluation.note,
                },
                weeklyReviews: i.weeklyReports
                  .filter(
                    (r) =>
                      r.reviewedAt &&
                      (h.source === "Migration" || r.reviewedAt >= h.startedAt),
                  )
                  .map((r) => ({
                    weekNumber: r.weekNumber,
                    mentorNote: r.mentorNote,
                    reviewedAt: r.reviewedAt,
                  })),
                finalReport: i.finalReport && {
                  score: i.finalReport.score,
                  mentorNote: i.finalReport.mentorNote,
                },
              }
            : {
                evaluations: i.supervisorEvaluations
                  .filter(
                    (e) =>
                      h.kind === "company" || e.supervisorId === h.targetId,
                  )
                  .map((e) => ({
                    score: e.total,
                    note: e.evidenceNote,
                    submittedAt: e.submittedAt,
                  })),
              };
      }
      if (scope.role === Role.Student && !i.finalGrade) snapshot = null;
      // Do not expose storage keys, file references or unrelated assessment payloads.
      const data = snapshot as {
        facultyEvaluation?: { score: number; note?: string };
        finalReport?: { score: number; mentorNote?: string };
        weeklyReviews?: {
          weekNumber: number;
          mentorNote?: string;
          reviewedAt?: string;
        }[];
        evaluations?: {
          total?: number;
          score?: number;
          evidenceNote?: string;
          note?: string;
          submittedAt?: string;
        }[];
      } | null;
      return {
        id: h.id,
        kind: h.kind,
        companyName:
          i.assignmentHistory.find(
            (a) => a.kind === "company" && a.targetId === h.companyId,
          )?.targetName ||
          (i.companyId === h.companyId ? i.company?.name : null),
        completed: !!i.finalGrade,
        name: h.targetName,
        startedAt: h.startedAt,
        endedAt: h.endedAt,
        source: h.source,
        reason: h.reason,
        snapshot: data && {
          facultyEvaluation: data.facultyEvaluation && {
            score: data.facultyEvaluation.score,
            note: data.facultyEvaluation.note,
          },
          finalReport: data.finalReport && {
            score: data.finalReport.score,
            mentorNote: data.finalReport.mentorNote,
          },
          weeklyReviews: data.weeklyReviews,
          evaluations: data.evaluations?.map((e) => ({
            score: e.score ?? e.total,
            note: e.note ?? e.evidenceNote,
            submittedAt: e.submittedAt,
          })),
        },
      };
    });
  }
  async export(user: AuthUser, q: SummaryQueryDto) {
    const scope = await this.scope(user);
    if (!scope.staff)
      throw new ForbiddenException(
        "Chỉ Trưởng khoa và Điều phối viên được xuất dữ liệu.",
      );
    const { rows } = await this.dataset(user, q);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Thực tập");
    sheet.addRow([
      "Mã sinh viên",
      "Họ tên",
      "Đợt",
      "Năm học",
      "Học kỳ",
      "Khoa",
      "Ngành",
      "Chương trình",
      "Khóa",
      "Công ty",
      "Giảng viên",
      "Trạng thái",
      "Báo cáo đã nộp",
      "Báo cáo quá hạn",
      "Điểm cuối",
    ]);
    for (const r of rows)
      sheet.addRow([
        r.student.studentCode,
        r.student.fullName,
        r.period.name,
        r.academicYear,
        r.semester,
        r.department?.name,
        r.major?.name,
        r.program?.name,
        r.cohort?.name,
        r.company?.name,
        r.mentor?.name,
        statusLabels[r.status],
        r.submittedReports,
        r.missingReports,
        r.finalGrade?.total,
      ]);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns.forEach((c) => {
      c.width = 24;
    });
    return workbook.xlsx.writeBuffer();
  }
}
