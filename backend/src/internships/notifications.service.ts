import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { SummaryService } from "./summary.service";
import { staffDepartment } from "./academic.service";
import { checkPeriodWindow, validateSchedule } from "./period-time";
import { NotificationQueryDto } from "./notifications.dto";

export function taskPriority(deadline: Date | null, now: Date) {
  if (!deadline) return "pending";
  const remaining = deadline.getTime() - now.getTime();
  return remaining < 0
    ? "overdue"
    : remaining <= 86400000
      ? "urgent"
      : remaining <= 259200000
        ? "soon"
        : "pending";
}
type Task = {
  id: string;
  type: string;
  title: string;
  context: string;
  href: string;
  priority: ReturnType<typeof taskPriority>;
  dueAt: string | null;
  count: number;
  period: { id: string; name: string } | null;
  blocked: boolean;
  actionLabel: string;
};
const paths: Record<Role, string> = {
  Admin: "admin",
  Student: "student",
  FacultyMentor: "mentor",
  FacultyManager: "faculty",
  InternshipCoordinator: "coordinator",
  Company: "company",
  CompanySupervisor: "supervisor",
};
const rank = { overdue: 0, urgent: 1, soon: 2, pending: 3 };

@Injectable()
export class NotificationsService {
  constructor(
    private readonly db: PrismaService,
    private readonly reports: SummaryService,
  ) {}
  async tasks(user: AuthUser, now = new Date()) {
    if (user.roles.length !== 1)
      throw new ForbiddenException("Vui lòng chọn không gian làm việc.");
    const role = user.roles[0],
      root = `/workspace/${paths[role]}`;
    const tasks: Task[] = [];
    const add = (
      type: string,
      id: string,
      title: string,
      href: string,
      due: Date | null = null,
      period: Task["period"] = null,
      context = "",
      count = 1,
      blocked = false,
    ) => {
      if (!count) return;
      tasks.push({
        id: `${type}:${id}`,
        type,
        title,
        href: root + href,
        dueAt: due?.toISOString() ?? null,
        priority: taskPriority(due, now),
        period,
        context,
        count,
        blocked,
        actionLabel: blocked ? "Xem tình trạng" : "Xem và xử lý",
      });
    };
    const near = (d: Date | null) =>
      !d || d.getTime() - now.getTime() <= 259200000;
    if (role === Role.Admin) {
      if (!user.permissions.includes("reports:platform"))
        throw new ForbiddenException();
      const [students, faculty, companies, staff, links] = await Promise.all([
        this.db.studentProfile.count({
          where: {
            userId: null,
            isVerified: true,
            departmentId: { not: null },
            majorId: { not: null },
            programId: { not: null },
            cohortId: { not: null },
          },
        }),
        this.db.facultyProfile.count({
          where: { userId: null, isActive: true, departmentId: { not: null } },
        }),
        this.db.companyProfile.count({
          where: {
            representativeUserId: null,
            isVerified: true,
            departmentId: { not: null },
          },
        }),
        this.db.user.count({
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
        this.db.departmentProgram.count({ where: { confirmed: false } }),
      ]);
      add(
        "provision",
        "student",
        "Hồ sơ sinh viên chờ cấp tài khoản",
        "/pending",
        null,
        null,
        "",
        students,
      );
      add(
        "provision",
        "faculty",
        "Hồ sơ giảng viên chờ cấp tài khoản",
        "/pending",
        null,
        null,
        "",
        faculty,
      );
      add(
        "provision",
        "company",
        "Hồ sơ doanh nghiệp chờ cấp tài khoản",
        "/pending",
        null,
        null,
        "",
        companies,
      );
      add(
        "staff-department",
        "all",
        "Cán bộ chưa được gán khoa",
        "/accounts",
        null,
        null,
        "",
        staff,
      );
      add(
        "catalog",
        "all",
        "Liên kết đào tạo chưa được xác nhận",
        "/catalog",
        null,
        null,
        "",
        links,
      );
    } else {
      const scope = await this.reports.scope(user, true);
      const records = await this.db.internship.findMany({
        where: {
          AND: [
            scope.where,
            { finalGrade: null, application: { status: { not: "Cancelled" } } },
          ],
        },
        select: {
          id: true,
          period: true,
          student: { select: { fullName: true, studentCode: true } },
          facultyEvaluation: { select: { id: true } },
          finalReport: { select: { score: true } },
          weeklyReports: {
            select: { id: true, weekNumber: true, status: true },
          },
          companySupervisorAssignments: { select: { supervisorId: true } },
          supervisorEvaluations: { select: { supervisorId: true } },
        },
      });
      for (const i of records) {
        const p = i.period,
          period = { id: p.id, name: p.name },
          context = `${i.student.fullName} · ${i.student.studentCode}`;
        const url = `?internshipId=${i.id}&periodId=${p.id}`;
        const allowed = (
          action: "weekly" | "report" | "grade" | "finalize",
          week?: number,
        ) => {
          try {
            checkPeriodWindow(p, action, now, week);
            return true;
          } catch {
            return false;
          }
        };
        const companyComplete =
          i.companySupervisorAssignments.length > 0 &&
          i.supervisorEvaluations.length ===
            i.companySupervisorAssignments.length &&
          i.companySupervisorAssignments.every((a) =>
            i.supervisorEvaluations.some(
              (e) => e.supervisorId === a.supervisorId,
            ),
          );
        if (role === Role.Student) {
          for (let week = 1; week <= p.weeklyReportCount; week++) {
            const report = i.weeklyReports.find((r) => r.weekNumber === week),
              due = p.weeklyDeadlines[week - 1] ?? null;
            if ((!report && near(due)) || report?.status === "NeedsRevision")
              add(
                "weekly-submit",
                `${i.id}:${week}`,
                report
                  ? `Bổ sung báo cáo tuần ${week}`
                  : `Nộp báo cáo tuần ${week}`,
                `/reports${url}&week=${week}`,
                due,
                period,
                context,
                1,
                !allowed("weekly", week),
              );
          }
          if (!i.finalReport && near(p.endsAt))
            add(
              "final-submit",
              i.id,
              "Nộp báo cáo cuối kỳ",
              `/reports${url}&section=final`,
              p.endsAt,
              period,
              context,
              1,
              !allowed("report") || !!i.facultyEvaluation,
            );
        } else if (role === Role.FacultyMentor) {
          for (const r of i.weeklyReports.filter(
            (r) => r.status === "Submitted",
          ))
            add(
              "weekly-review",
              r.id,
              `Nhận xét báo cáo tuần ${r.weekNumber}`,
              `/students${url}&week=${r.weekNumber}`,
              p.gradingDeadline,
              period,
              context,
              1,
              !allowed("grade"),
            );
          if (
            i.finalReport &&
            i.finalReport.score === null &&
            near(p.gradingDeadline)
          )
            add(
              "final-score",
              i.id,
              "Chấm báo cáo cuối kỳ",
              `/students${url}`,
              p.gradingDeadline,
              period,
              context,
              1,
              !allowed("grade"),
            );
          if (!i.facultyEvaluation && near(p.gradingDeadline))
            add(
              "faculty-score",
              i.id,
              "Hoàn thành đánh giá hướng dẫn",
              `/students${url}`,
              p.gradingDeadline,
              period,
              context,
              1,
              !allowed("grade"),
            );
        } else if (role === Role.CompanySupervisor) {
          if (
            !i.supervisorEvaluations.some(
              (e) => e.supervisorId === scope.targetId,
            ) &&
            near(p.gradingDeadline)
          )
            add(
              "supervisor-score",
              i.id,
              "Hoàn thành phiếu đánh giá",
              `/students${url}`,
              p.gradingDeadline,
              period,
              context,
              1,
              !allowed("grade"),
            );
        } else if (role === Role.Company) {
          if (!i.companySupervisorAssignments.length)
            add(
              "supervisor-assign",
              i.id,
              "Phân công người hướng dẫn",
              `/students${url}`,
              null,
              period,
              context,
            );
          else if (!companyComplete && near(p.gradingDeadline))
            add(
              "company-followup",
              i.id,
              "Đôn đốc đánh giá doanh nghiệp",
              `/students${url}`,
              p.gradingDeadline,
              period,
              context,
              1,
              !allowed("grade"),
            );
        } else if (role === Role.FacultyManager) {
          if (i.facultyEvaluation && companyComplete)
            add(
              "finalize",
              i.id,
              "Hồ sơ đủ điều kiện chốt điểm",
              `/grades${url}`,
              p.finalizationDeadline,
              period,
              context,
              1,
              !allowed("finalize"),
            );
          else if (near(p.finalizationDeadline))
            add(
              "evaluation-followup",
              i.id,
              "Hồ sơ thiếu đánh giá để chốt điểm",
              `/summary?periodId=${p.id}&search=${encodeURIComponent(i.student.studentCode)}`,
              p.finalizationDeadline,
              period,
              context,
            );
        } else {
          const missing =
            p.weeklyDeadlines.some(
              (d, n) =>
                d < now &&
                !i.weeklyReports.some(
                  (r) => r.weekNumber === n + 1 && r.status !== "NeedsRevision",
                ),
            ) ||
            (!i.finalReport && p.endsAt < now);
          if (missing)
            add(
              "report-followup",
              i.id,
              "Đôn đốc báo cáo quá hạn",
              `/progress${url}`,
              p.weeklyDeadlines.find(
                (d, n) =>
                  d < now &&
                  !i.weeklyReports.some(
                    (r) =>
                      r.weekNumber === n + 1 && r.status !== "NeedsRevision",
                  ),
              ) ?? p.endsAt,
              period,
              context,
            );
          if (
            (!companyComplete ||
              !i.facultyEvaluation ||
              (i.finalReport && i.finalReport.score === null)) &&
            near(p.gradingDeadline)
          )
            add(
              "evaluation-followup",
              i.id,
              "Đôn đốc hoàn thiện đánh giá",
              `/progress${url}`,
              p.gradingDeadline,
              period,
              context,
            );
        }
      }
      if (role === Role.Student || scope.staff) {
        const periodWhere: Prisma.InternshipPeriodWhereInput = scope.staff
          ? {
              departmentId: staffDepartment(user),
              ...(role === Role.InternshipCoordinator
                ? { coordinatorId: user.id }
                : {}),
            }
          : {};
        const apps = await this.db.internshipApplication.findMany({
          where: {
            ...(scope.staff
              ? { period: periodWhere, status: "Submitted" }
              : { student: { userId: user.id }, status: "NeedsRevision" }),
          },
          select: {
            id: true,
            companyId: true,
            externalCompanyName: true,
            period: true,
            student: { select: { fullName: true, studentCode: true } },
            exceptionRequest: { select: { status: true } },
          },
        });
        for (const a of apps) {
          const p = { id: a.period.id, name: a.period.name },
            context = `${a.student.fullName} · ${a.student.studentCode}`,
            url = `?periodId=${p.id}&applicationId=${a.id}`;
          if (role === Role.Student)
            add(
              "application-revise",
              a.id,
              "Bổ sung hồ sơ đăng ký",
              `/applications${url}`,
              a.period.registrationEndsAt,
              p,
              context,
              1,
              now > a.period.registrationEndsAt,
            );
          if (role === Role.FacultyManager) {
            add(
              "application-review",
              a.id,
              "Duyệt hồ sơ đăng ký",
              `/approvals${url}`,
              null,
              p,
              context,
            );
            if (a.exceptionRequest?.status === "Pending")
              add(
                "exception-review",
                a.id,
                "Quyết định ngoại lệ học vụ",
                `/exceptions${url}`,
                null,
                p,
                context,
              );
          }
          if (
            role === Role.InternshipCoordinator &&
            !a.companyId &&
            a.externalCompanyName
          )
            add(
              "external-company",
              a.id,
              "Xác minh doanh nghiệp đề xuất",
              `/companies${url}`,
              null,
              p,
              context,
            );
        }
        if (scope.staff) {
          const periods = await this.db.internshipPeriod.findMany({
            where: {
              ...periodWhere,
              ...(role === Role.FacultyManager ? { coordinatorId: null } : {}),
            },
          });
          for (const p of periods) {
            if (role === Role.FacultyManager)
              add(
                "coordinator-assign",
                p.id,
                "Gán điều phối viên phụ trách đợt",
                `/assignments?periodId=${p.id}`,
                null,
                { id: p.id, name: p.name },
              );
            else {
              let invalid =
                !p.departmentId ||
                !p.academicYear ||
                !p.semester ||
                !p.roundNumber;
              try {
                validateSchedule(p);
              } catch {
                invalid = true;
              }
              if (invalid)
                add(
                  "period-config",
                  p.id,
                  "Hoàn thiện cấu hình đợt",
                  `/periods?periodId=${p.id}`,
                  null,
                  { id: p.id, name: p.name },
                );
            }
          }
        }
      }
      if (role === Role.InternshipCoordinator) {
        const departmentId = staffDepartment(user);
        const [students, companies] = await Promise.all([
          this.db.studentProfile.count({
            where: { departmentId, isVerified: false },
          }),
          this.db.companyProfile.count({
            where: { departmentId, isVerified: false },
          }),
        ]);
        add(
          "profile-verify",
          "students",
          "Hồ sơ học vụ chờ xác minh",
          "/profiles",
          null,
          null,
          "",
          students,
        );
        add(
          "company-verify",
          "companies",
          "Doanh nghiệp chờ xác minh",
          "/companies",
          null,
          null,
          "",
          companies,
        );
      }
      if (role === Role.FacultyMentor && scope.targetId) {
        const mentor = await this.db.facultyProfile.findUnique({
          where: { id: scope.targetId },
        });
        if (mentor?.isActive && mentor.departmentId) {
          const requests = await this.db.mentorRequest.findMany({
            where: {
              facultyMentorId: mentor.id,
              response: "Pending",
              closedAt: null,
              application: {
                status: "Submitted",
                period: {
                  departmentId: mentor.departmentId,
                  status: "Published",
                  endsAt: { gt: now },
                },
              },
            },
            select: {
              id: true,
              application: {
                select: {
                  period: { select: { id: true, name: true, endsAt: true } },
                  student: { select: { fullName: true } },
                },
              },
            },
          });
          for (const r of requests)
            add(
              "mentor-request",
              r.id,
              "Phản hồi đề xuất hướng dẫn",
              `/requests?periodId=${r.application.period.id}&requestId=${r.id}`,
              r.application.period.endsAt,
              r.application.period,
              r.application.student.fullName,
            );
        }
      }
    }
    // Follow-up queues are grouped by period; counts describe affected records.
    const grouped = new Map<string, Task>();
    for (const task of tasks) {
      const group = task.type.endsWith("followup") && task.period;
      const key = group ? `${task.type}:${task.period!.id}` : task.id;
      const previous = grouped.get(key);
      if (previous) {
        previous.count += task.count;
        if (
          rank[task.priority] < rank[previous.priority] ||
          (task.dueAt && task.dueAt < (previous.dueAt ?? "z"))
        ) {
          previous.priority = task.priority;
          previous.dueAt = task.dueAt;
        }
      } else
        grouped.set(key, {
          ...task,
          id: key,
          ...(group
            ? {
                context: "Danh sách cần theo dõi trong đợt",
                href: task.href.split("?")[0] + `?periodId=${task.period!.id}`,
              }
            : {}),
        });
    }
    return [...grouped.values()].sort(
      (a, b) =>
        rank[a.priority] - rank[b.priority] ||
        (a.dueAt ?? "z").localeCompare(b.dueAt ?? "z") ||
        a.id.localeCompare(b.id),
    );
  }
  async summary(user: AuthUser) {
    const now = new Date(),
      tasks = await this.tasks(user, now);
    return {
      total: tasks.length,
      counts: Object.fromEntries(
        Object.keys(rank).map((k) => [
          k,
          tasks.filter((t) => t.priority === k).length,
        ]),
      ),
      computedAt: now.toISOString(),
    };
  }
  async list(user: AuthUser, q: NotificationQueryDto) {
    const now = new Date(),
      all = await this.tasks(user, now);
    const normalize = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .toLowerCase();
    const rows = all.filter(
      (t) =>
        (!q.priority || t.priority === q.priority) &&
        (!q.type || t.type === q.type) &&
        (!q.periodId || t.period?.id === q.periodId) &&
        (!q.search ||
          normalize(`${t.title} ${t.context} ${t.period?.name ?? ""}`).includes(
            normalize(q.search),
          )),
    );
    return {
      items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
      total: rows.length,
      page: q.page,
      pageSize: q.pageSize,
      computedAt: now.toISOString(),
      options: {
        types: [
          ...new Map(
            all.map((t) => [
              t.type,
              { id: t.type, name: t.title.replace(/ tuần \d+/, " tuần") },
            ]),
          ).values(),
        ],
        periods: [
          ...new Map(
            all.filter((t) => t.period).map((t) => [t.period!.id, t.period!]),
          ).values(),
        ],
      },
    };
  }
}
