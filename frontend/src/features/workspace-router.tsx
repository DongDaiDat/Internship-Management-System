"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import { MentorPortal } from "./mentor-portal";
import { CompanyPortal } from "./company-portal";
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
    ["profiles", "Hồ sơ học vụ", "people"],
    ["import", "Import hồ sơ", "file"],
    ["companies", "Doanh nghiệp", "people"],
    ["periods", "Đợt thực tập", "calendar"],
    ["applications", "Theo dõi đăng ký", "check"],
    ["progress", "Tiến độ thực tập", "file"],
  ],
  FacultyManager: [
    ["overview", "Tổng quan khoa", "grid"],
    ["approvals", "Duyệt đăng ký", "check"],
    ["exceptions", "Ngoại lệ học vụ", "file"],
    ["assignments", "Phụ trách đợt", "people"],
    ["grades", "Chốt điểm", "check"],
    ["results", "Kết quả thực tập", "file"],
  ],
  Student: [
    ["overview", "Tổng quan", "grid"],
    ["profile", "Hồ sơ cá nhân", "people"],
    ["registration", "Đăng ký thực tập", "calendar"],
    ["applications", "Hồ sơ đăng ký", "check"],
    ["reports", "Báo cáo thực tập", "file"],
    ["documents", "Tệp và minh chứng", "file"],
    ["results", "Kết quả thực tập", "cap"],
  ],
  FacultyMentor: [["overview", "Hướng dẫn thực tập", "cap"]],
  Company: [["overview", "Sinh viên thực tập", "people"]],
  CompanySupervisor: [["overview", "Hướng dẫn & đánh giá", "check"]],
};
function Overview({ admin }: { admin: boolean }) {
  const [data, setData] = useState<Record<string, number> | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    api<Record<string, number>>(admin ? "/users/summary" : "/dashboard", {
      signal: c.signal,
    })
      .then(setData)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [admin]);
  const metrics = admin
    ? [
        ["accounts", "Tài khoản", "Người dùng trong hệ thống"],
        ["pending", "Chờ cấp tài khoản", "Hồ sơ chưa có tài khoản"],
        ["departments", "Khoa đào tạo", "Đơn vị quản lý"],
        ["incompletePeriods", "Cần hoàn thiện", "Đợt cũ chưa được phân khoa"],
      ]
    : [
        ["periods", "Đợt thực tập", "Trong phạm vi phụ trách"],
        ["pendingApplications", "Đăng ký chờ duyệt", "Hồ sơ đang xử lý"],
        ["activeInternships", "Đang thực tập", "Sinh viên đang tham gia"],
        ["lateReports", "Báo cáo quá hạn", "Cần theo dõi tiến độ"],
        ["graded", "Đã chốt điểm", "Kết quả hoàn thành"],
      ];
  return (
    <>
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">MỖI BƯỚC ĐI, MỘT CƠ HỘI MỚI</span>
          <h2>
            {admin
              ? "Kết nối một kỳ thực tập hiệu quả"
              : "Đồng hành cùng sinh viên"}
          </h2>
          <p>
            {admin
              ? "Chuẩn bị tài khoản và dữ liệu đào tạo cho toàn trường."
              : "Theo dõi những việc cần xử lý và kết quả thực tập của khoa."}
          </p>
        </div>
        <span className="banner-art" aria-hidden="true">
          P
        </span>
      </div>
      <div className="overview-metrics">
        {metrics.map(([key, label, hint]) => (
          <section className="card" key={key}>
            <span>{label}</span>
            <strong>{data ? (data[key] ?? 0) : "—"}</strong>
            <small>{hint}</small>
          </section>
        ))}
      </div>
      <section className="card">
        <h2>Việc cần chú ý</h2>
        {!data ? (
          <p role="status">Đang tải tổng quan…</p>
        ) : (
          <>
            {admin ? (
              <>
                <p>
                  <strong>{data.pending}</strong> hồ sơ đang chờ cấp tài khoản.
                </p>
                <p>
                  <strong>{data.incompletePeriods}</strong> đợt cần phân khoa
                  trước khi hoàn thiện.
                </p>
              </>
            ) : (
              <>
                <p>
                  <strong>{data.pendingApplications}</strong> hồ sơ đăng ký chờ
                  phê duyệt.
                </p>
                <p>
                  <strong>{data.lateReports}</strong> báo cáo tuần quá hạn chưa
                  nộp.
                </p>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}
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
  const view = segments[3] || "overview";
  const navigation = menus[role].map(([key, label, icon]) => ({
    key,
    label,
    icon,
    href: `/workspace/${rolePaths[role]}/${key}`,
  }));
  const valid =
    navigation.some((n) => n.key === view) &&
    (!requested || user.roles.includes(requested));
  useEffect(() => {
    if (!requested) router.replace(`/workspace/${rolePaths[role]}/overview`);
  }, [requested, role, router]);
  const [periodId, setPeriod] = useState("");
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
      <WorkspaceShell
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
            {isStaff && !user.departmentId && (
              <p role="alert" className="login-error">
                Tài khoản chưa được gán khoa. Liên hệ Admin để hoàn thiện quyền
                truy cập.
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
            {view === "overview" && (role === "Admin" || isStaff) && (
              <Overview admin={role === "Admin"} />
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
            {role === "Student" && <StudentPortal view={view as StudentView} />}
            {role === "FacultyMentor" && <MentorPortal />}
            {(role === "Company" || role === "CompanySupervisor") && (
              <CompanyPortal />
            )}
          </div>
        )}
      </WorkspaceShell>
    </DepartmentContext.Provider>
  );
}
