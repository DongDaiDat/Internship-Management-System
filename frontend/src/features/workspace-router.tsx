"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, CurrentUser, Role, roleLabels } from "../lib/api";
import { WorkspaceShell } from "./workspace-shell";
import { AccountCenter } from "./account-center";
import { CatalogCenter } from "./catalog-center";
import { DepartmentContext } from "./academic-fields";
import { PeriodCenter } from "./period-center";
import { ProfilePanel, ImportPanel } from "./internship-hub";
import { FacultyPortal } from "./faculty-portal";
import { ApplicationReport } from "./application-report";
import { ProgressReport } from "./progress-report";
import { ExternalCompanyPanel } from "./external-company-panel";
import { StudentPortal, StudentView } from "./student-portal";
import { StudentInternshipHistory } from "./student-workspace-pages";
import { MentorRequestsPage } from "./mentor-requests-page";
import { MentorPortal } from "./mentor-portal";
import { CompanyPortal } from "./company-portal";
import { SummaryOverview, SummaryList } from "./summary-pages";
import {
  NotificationsProvider,
  NotificationBell,
  TasksPage,
  TasksPreview,
} from "./notifications";
const rolePaths: Record<Role, string> = {
  Admin: "admin",
  InternshipCoordinator: "coordinator",
  FacultyManager: "faculty",
  Student: "student",
  FacultyMentor: "mentor",
  Company: "company",
  CompanySupervisor: "supervisor",
};
const menus: Record<Role, [string, string, string][]> = {
  Admin: [
    ["overview", "Tổng quan", "grid"],
    ["accounts", "Tài khoản", "people"],
    ["pending", "Chờ cấp tài khoản", "check"],
    ["catalog", "Danh mục đào tạo", "cap"],
  ],
  InternshipCoordinator: [
    ["overview", "Tổng quan", "grid"],
    ["summary", "Tổng hợp thực tập", "grid"],
    ["profiles", "Hồ sơ học vụ", "people"],
    ["import", "Import hồ sơ", "file"],
    ["companies", "Doanh nghiệp", "people"],
    ["periods", "Đợt thực tập", "calendar"],
    ["applications", "Theo dõi đăng ký", "check"],
    ["progress", "Tiến độ thực tập", "file"],
  ],
  FacultyManager: [
    ["overview", "Tổng quan khoa", "grid"],
    ["summary", "Tổng hợp khoa", "grid"],
    ["approvals", "Duyệt đăng ký", "check"],
    ["exceptions", "Ngoại lệ học vụ", "file"],
    ["assignments", "Phụ trách đợt", "people"],
    ["grades", "Chốt điểm", "check"],
    ["results", "Kết quả thực tập", "file"],
  ],
  Student: [
    ["overview", "Tổng quan", "grid"],
    ["history", "Lịch sử thực tập", "calendar"],
    ["profile", "Hồ sơ cá nhân", "people"],
    ["registration", "Đăng ký thực tập", "calendar"],
    ["applications", "Hồ sơ đăng ký", "check"],
    ["reports", "Báo cáo thực tập", "file"],
    ["documents", "Tệp và minh chứng", "file"],
    ["results", "Kết quả thực tập", "cap"],
  ],
  FacultyMentor: [
    ["overview", "Tổng quan hướng dẫn", "grid"],
    ["summary", "Sinh viên đang hướng dẫn", "people"],
    ["students", "Nhận xét & đánh giá", "check"],
    ["history", "Lịch sử hướng dẫn", "calendar"],
    ["requests", "Đề xuất hướng dẫn", "cap"],
  ],
  Company: [
    ["overview", "Tổng quan doanh nghiệp", "grid"],
    ["summary", "Danh sách thực tập", "people"],
    ["students", "Phân công & đánh giá", "check"],
    ["history", "Lịch sử tiếp nhận", "calendar"],
  ],
  CompanySupervisor: [
    ["overview", "Tổng quan hướng dẫn", "grid"],
    ["summary", "Danh sách hướng dẫn", "people"],
    ["students", "Hướng dẫn & đánh giá", "check"],
    ["history", "Lịch sử hướng dẫn", "calendar"],
  ],
};
export function WorkspaceRouter({
  user,
  onLogout,
  loggingOut,
}: {
  user: CurrentUser;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const pathname = usePathname(),
    router = useRouter();
  const segments = pathname.split("/");
  const requested = (Object.keys(rolePaths) as Role[]).find(
    (r) => rolePaths[r] === segments[2],
  );
  const role =
    requested && user.roles.includes(requested) ? requested : user.roles[0];
  const requestedView = segments[3] || "overview";
  const legacyStudentSummary =
    role === "Student" && requestedView === "summary";
  const view = legacyStudentSummary ? "overview" : requestedView;
  const navigation = [...menus[role], ["tasks", "Việc cần làm", "check"]].map(
    ([key, label, icon]) => ({
      key,
      label,
      icon,
      href: `/workspace/${rolePaths[role]}/${key}`,
    }),
  );
  const valid =
    navigation.some((n) => n.key === view) &&
    (!requested || user.roles.includes(requested));
  useEffect(() => {
    if (legacyStudentSummary) router.replace("/workspace/student/overview");
    else if (!requested)
      router.replace(`/workspace/${rolePaths[role]}/overview`);
  }, [legacyStudentSummary, requested, role, router]);
  const searchParams = useSearchParams();
  const [periodId, setPeriod] = useState(searchParams.get("periodId") || "");
  useEffect(
    () => setPeriod(searchParams.get("periodId") || ""),
    [searchParams],
  );
  const [periods, setPeriods] = useState<
    { id: string; name: string; department?: { name: string } }[]
  >([]);
  const isStaff = role === "FacultyManager" || role === "InternshipCoordinator";
  useEffect(() => {
    if (!isStaff) return;
    const c = new AbortController();
    api<typeof periods>("/internship-periods", { signal: c.signal })
      .then(setPeriods)
      .catch(() => setPeriods([]));
    return () => c.abort();
  }, [isStaff, role]);
  const filters = [
    "applications",
    "progress",
    "approvals",
    "exceptions",
    "grades",
    "results",
  ].includes(view);
  return (
    <DepartmentContext.Provider value={user.departmentId || ""}>
      <NotificationsProvider key={user.id + role}>
        <WorkspaceShell
          notifications={<NotificationBell />}
          variant={role === "Student" ? "student" : undefined}
          title={
            navigation.find((n) => n.key === view)?.label ||
            "Không có quyền truy cập"
          }
          subtitle={
            role === "Admin"
              ? "Quản trị hệ thống và dữ liệu đào tạo"
              : "Không gian thực tập của Trường Công nghệ thông tin Phenikaa"
          }
          name={user.fullName}
          role={roleLabels[role]}
          navigation={navigation}
          current={view}
          logout={
            <button
              className="text-button"
              disabled={loggingOut}
              onClick={onLogout}
            >
              {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
            </button>
          }
          rolePicker={
            user.roles.length > 1 ? (
              <label className="role-picker">
                Vai trò
                <select
                  value={role}
                  onChange={(e) =>
                    router.push(
                      `/workspace/${rolePaths[e.target.value as Role]}/overview`,
                    )
                  }
                >
                  {user.roles.map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
                </select>
              </label>
            ) : undefined
          }
        >
          {!valid ? (
            <section className="card">
              <h2>Chức năng không thuộc vai trò hiện tại</h2>
              <Link href={navigation[0].href}>Về tổng quan</Link>
            </section>
          ) : (
            <div key={role + view}>
              {view === "tasks" && <TasksPage />}
              {isStaff && !user.departmentId && (
                <p role="alert" className="login-error">
                  Tài khoản chưa được gán khoa. Liên hệ Admin để hoàn thiện
                  quyền truy cập.
                </p>
              )}
              {isStaff && filters && (
                <div className="filter-bar">
                  <label>
                    Đợt thực tập
                    <select
                      value={periodId}
                      onChange={(e) => setPeriod(e.target.value)}
                    >
                      <option value="">Tất cả đợt phụ trách</option>
                      {periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.department?.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {view === "overview" && role !== "Student" && (
                <SummaryOverview role={role} />
              )}
              {view === "overview" && <TasksPreview />}
              {(view === "summary" || view === "history") &&
                role !== "Admin" &&
                role !== "Student" && (
                  <SummaryList role={role} history={view === "history"} />
                )}
              {role === "Student" && view === "history" && (
                <StudentInternshipHistory />
              )}
              {role === "Admin" &&
                (view === "accounts" || view === "pending") && (
                  <AccountCenter mode={view} user={user} />
                )}
              {role === "Admin" && view === "catalog" && <CatalogCenter />}
              {role === "InternshipCoordinator" && view === "profiles" && (
                <ProfilePanel />
              )}
              {role === "InternshipCoordinator" && view === "companies" && (
                <>
                  <ProfilePanel initialType="companies" />
                  <ExternalCompanyPanel />
                </>
              )}
              {role === "InternshipCoordinator" && view === "import" && (
                <ImportPanel onConfirmed={() => undefined} />
              )}
              {role === "InternshipCoordinator" && view === "periods" && (
                <PeriodCenter user={user} />
              )}
              {role === "FacultyManager" && view === "assignments" && (
                <PeriodCenter user={user} assignment />
              )}
              {role === "InternshipCoordinator" && view === "applications" && (
                <ApplicationReport periodId={periodId} />
              )}
              {role === "InternshipCoordinator" && view === "progress" && (
                <>
                  <ProgressReport periodId={periodId} />
                  <FacultyPortal
                    canApprove={false}
                    view="operations"
                    periodId={periodId}
                  />
                </>
              )}
              {role === "FacultyManager" &&
                ["approvals", "exceptions", "grades"].includes(view) && (
                  <FacultyPortal
                    canApprove
                    view={view as "approvals" | "exceptions" | "grades"}
                    periodId={periodId}
                  />
                )}
              {role === "FacultyManager" && view === "results" && (
                <ProgressReport periodId={periodId} />
              )}
              {role === "Student" && !["history", "tasks"].includes(view) && (
                <StudentPortal view={view as StudentView} />
              )}
              {role === "FacultyMentor" &&
                (view === "requests" ? (
                  <MentorRequestsPage />
                ) : view === "students" ? (
                  <MentorPortal />
                ) : null)}
              {(role === "Company" || role === "CompanySupervisor") &&
                view === "students" && <CompanyPortal />}
            </div>
          )}
        </WorkspaceShell>
      </NotificationsProvider>
    </DepartmentContext.Provider>
  );
}
