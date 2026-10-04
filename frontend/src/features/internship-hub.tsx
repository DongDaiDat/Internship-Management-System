"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  api,
  ApiError,
  CurrentUser,
  roleLabels,
  workspaceHeaders,
} from "../lib/api";
import { StudentPortal } from "./student-portal";
import { MentorPortal } from "./mentor-portal";
import { CompanyPortal } from "./company-portal";
import { FacultyPortal } from "./faculty-portal";
import { ProfileEditor, StudentContactEditor } from "./profile-editor";
import { ExternalCompanyPanel } from "./external-company-panel";
import { ApplicationReport } from "./application-report";
import { ProgressReport } from "./progress-report";
import { ReadinessReport } from "./readiness-report";
import { DashboardDetails } from "./dashboard-details";

type Period = {
  id: string;
  coordinatorId: string | null;
  name: string;
  registrationStartsAt: string;
  registrationEndsAt: string;
  startsAt: string;
  endsAt: string;
  weeklyReportCount: number;
  weeklyDeadlines: string[];
  gradingDeadline: string | null;
  finalizationDeadline: string | null;
  creditThresholdPercent: number;
  status: "Draft" | "Published" | "Closed";
};
type Dashboard = {
  scope: string;
  students: number;
  periods: number;
  pendingApplications: number;
  activeInternships: number;
  verifiedCompanies: number;
  pendingCompanies: number;
  lateReports: number;
  submittedLateReports: number;
  revisionReports: number;
  pendingReviews: number;
  missingSchedules: number;
  graded: number;
  averageGrade: number | null;
};
type ImportType = "Students" | "Faculty" | "Companies";

export function InternshipHub({
  user,
  onLogout,
  loggingOut,
}: {
  user: CurrentUser;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [dashboardPeriod, setDashboardPeriod] = useState("");
  const [detailMetric, setDetailMetric] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const canManage = user.permissions.includes("profiles:write");
  const canSeeDashboard = user.permissions.includes("dashboard:read");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refresh = () => setRefreshVersion((value) => value + 1);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setDashboard(null);
    const jobs: Promise<unknown>[] = [
      api<Period[]>("/internship-periods", { signal: controller.signal }).then(
        (value) => {
          if (!controller.signal.aborted) setPeriods(value);
        },
      ),
    ];
    if (canSeeDashboard)
      jobs.push(
        api<Dashboard>(
          `/dashboard${dashboardPeriod ? `?periodId=${dashboardPeriod}` : ""}`,
          { signal: controller.signal },
        ).then((value) => {
          if (!controller.signal.aborted) setDashboard(value);
        }),
      );
    void Promise.all(jobs)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [canSeeDashboard, dashboardPeriod, refreshVersion]);
  return (
    <div className="admin-workspace internship-workspace">
      <header className="admin-header">
        <span className="auth-mark">interna.</span>
        <span className="admin-badge">TRƯỜNG CNTT PHENIKAA</span>
        <div>
          <strong>{user.fullName}</strong>
          <button
            className="button secondary"
            onClick={onLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
          </button>
        </div>
      </header>
      <main className="admin-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">QUẢN LÝ THỰC TẬP TỐT NGHIỆP</p>
            <h1>
              Không gian{" "}
              {user.roles.map((role) => roleLabels[role]).join(" · ")}
            </h1>
            <p>Dữ liệu chính thức của Trường Công nghệ Thông tin Phenikaa.</p>
          </div>
          <button className="button secondary" onClick={refresh}>
            Làm mới
          </button>
        </div>
        {error && (
          <div className="empty-state" role="alert">
            <p>{error}</p>
            <button className="button secondary" onClick={refresh}>
              Thử lại
            </button>
          </div>
        )}
        {canSeeDashboard && (
          <label className="profile-editor">
            Lọc báo cáo theo đợt
            <select
              value={dashboardPeriod}
              onChange={(e) => setDashboardPeriod(e.target.value)}
            >
              <option value="">Tất cả đợt trong phạm vi</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {canSeeDashboard && dashboard && !loading && (
          <section
            className="metric-grid"
            aria-label="Tổng quan thực tập"
            onClick={(event) => {
              const button = (
                event.target as HTMLElement
              ).closest<HTMLButtonElement>("button[data-metric]");
              if (button) setDetailMetric(button.dataset.metric ?? "");
            }}
          >
            <Metric label="Sinh viên" value={dashboard.students} />
            <Metric
              label="Đề xuất công ty chờ xác minh"
              value={dashboard.pendingCompanies}
            />
            <Metric label="Đợt thực tập" value={dashboard.periods} />
            <Metric
              label="Chờ phê duyệt"
              value={dashboard.pendingApplications}
            />
            <Metric label="Đang thực tập" value={dashboard.activeInternships} />
            <Metric
              label="Công ty xác minh"
              value={dashboard.verifiedCompanies}
            />
            <Metric
              label="Quá hạn chưa nộp (tuần)"
              value={dashboard.lateReports}
            />
            <Metric
              label="Bản nộp hiện tại muộn"
              value={dashboard.submittedLateReports}
            />
            <Metric
              label="Báo cáo chờ nhận xét"
              value={dashboard.pendingReviews}
            />
            <Metric
              label="Báo cáo cần bổ sung"
              value={dashboard.revisionReports}
            />
            <Metric
              label="Hồ sơ thực tập thiếu lịch tuần"
              value={dashboard.missingSchedules}
            />
            <Metric label="Đã chốt điểm" value={dashboard.graded} />
            <Metric
              label="Điểm trung bình"
              value={dashboard.averageGrade?.toFixed(2) ?? "—"}
            />
          </section>
        )}
        {canSeeDashboard && detailMetric && (
          <DashboardDetails
            key={`${dashboardPeriod}-${detailMetric}-${refreshVersion}`}
            metric={detailMetric}
            periodId={dashboardPeriod}
          />
        )}
        {canSeeDashboard && (
          <ApplicationReport
            key={`applications-${dashboardPeriod}-${refreshVersion}`}
            periodId={dashboardPeriod}
          />
        )}
        {canSeeDashboard && (
          <ProgressReport
            key={`progress-${dashboardPeriod}-${refreshVersion}`}
            periodId={dashboardPeriod}
          />
        )}
        {canSeeDashboard && (
          <ReadinessReport
            key={`readiness-${dashboardPeriod}-${refreshVersion}`}
            periodId={dashboardPeriod}
          />
        )}
        {canManage && (
          <div className="workspace-grid">
            <PeriodEditor onCreated={refresh} />
            <ImportPanel onConfirmed={refresh} />
          </div>
        )}
        {canManage && <ProfilePanel key={`profiles-${refreshVersion}`} />}
        {user.roles.includes("Student") && (
          <section className="card">
            <StudentContactEditor />
          </section>
        )}
        {user.roles.includes("Student") && <StudentPortal />}
        {user.roles.some(
          (role) =>
            role === "FacultyManager" || role === "InternshipCoordinator",
        ) && (
          <FacultyPortal
            key={`faculty-${dashboardPeriod}`}
            periodId={dashboardPeriod}
            canApprove={user.roles.includes("FacultyManager")}
          />
        )}
        {canManage && <ExternalCompanyPanel />}
        {user.roles.some(
          (role) => role === "Company" || role === "CompanySupervisor",
        ) && <CompanyPortal />}
        {user.roles.includes("FacultyMentor") &&
          !user.roles.includes("Student") && <MentorPortal />}
        <section className="card">
          <div className="section-title">
            <div>
              <h2>Đợt thực tập</h2>
              <p>Thời gian sẽ được khóa sau khi công bố.</p>
            </div>
          </div>
          {loading ? (
            <p className="empty-state">Đang tải dữ liệu…</p>
          ) : periods.length ? (
            <div className="table-scroll">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Đợt</th>
                    <th>Đăng ký</th>
                    <th>Thực tập</th>
                    <th>Báo cáo</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => (
                    <tr key={period.id}>
                      <td>
                        <strong>{period.name}</strong>
                        {user.roles.some(
                          (r) => r === "Admin" || r === "FacultyManager",
                        ) && (
                          <CoordinatorAssignment
                            period={period}
                            onSaved={refresh}
                          />
                        )}
                        <small>
                          Ngưỡng tín chỉ: {period.creditThresholdPercent}%
                        </small>
                      </td>
                      <td>
                        {date(period.registrationStartsAt)}
                        <small>đến {date(period.registrationEndsAt)}</small>
                      </td>
                      <td>
                        {date(period.startsAt)}
                        <small>đến {date(period.endsAt)}</small>
                      </td>
                      <td>
                        {period.weeklyReportCount} tuần
                        <details>
                          <summary>Xem hạn nộp và chấm</summary>
                          {period.weeklyDeadlines.map((deadline, index) => (
                            <small key={index}>
                              Tuần {index + 1}:{" "}
                              {new Date(deadline).toLocaleString("vi-VN")}
                            </small>
                          ))}
                          <small>
                            Hạn chấm:{" "}
                            {period.gradingDeadline
                              ? new Date(period.gradingDeadline).toLocaleString(
                                  "vi-VN",
                                )
                              : "Chưa cấu hình"}
                          </small>
                          <small>
                            Hạn tổng kết:{" "}
                            {period.finalizationDeadline
                              ? new Date(
                                  period.finalizationDeadline,
                                ).toLocaleString("vi-VN")
                              : "Chưa cấu hình"}
                          </small>
                        </details>
                      </td>
                      <td>
                        <span
                          className={
                            period.status === "Published"
                              ? "status"
                              : "subtle-badge"
                          }
                        >
                          {period.status === "Published"
                            ? "Đã công bố"
                            : period.status === "Draft"
                              ? "Bản nháp"
                              : "Đã đóng"}
                        </span>
                        {canManage && period.status === "Draft" && (
                          <PublishPeriod id={period.id} onPublished={refresh} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <h3>Chưa có đợt thực tập</h3>
              <p>
                {canManage
                  ? "Tạo đợt đầu tiên, sau đó import và xác minh hồ sơ."
                  : "Khoa chưa công bố đợt thực tập."}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  const metrics: Record<string, string> = {
    "Sinh viên": "students",
    "Đề xuất công ty chờ xác minh": "pendingCompanies",
    "Đợt thực tập": "periods",
    "Chờ phê duyệt": "pendingApplications",
    "Đang thực tập": "activeInternships",
    "Công ty xác minh": "verifiedCompanies",
    "Quá hạn chưa nộp (tuần)": "lateReports",
    "Bản nộp hiện tại muộn": "submittedLateReports",
    "Báo cáo chờ nhận xét": "pendingReviews",
    "Báo cáo cần bổ sung": "revisionReports",
    "Hồ sơ thực tập thiếu lịch tuần": "missingSchedules",
    "Đã chốt điểm": "graded",
    "Điểm trung bình": "graded",
  };
  return (
    <button
      type="button"
      className="metric-card"
      data-metric={metrics[label]}
      aria-label={`Xem chi tiết: ${label}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}
function date(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}
export function CoordinatorAssignment({
  period,
  onSaved,
}: {
  period: Period;
  onSaved: () => void;
}) {
  const [options, setOptions] = useState<
    { id: string; fullName: string; email: string }[]
  >([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open && !options.length)
          void api<typeof options>("/internship-coordinators")
            .then(setOptions)
            .catch((cause: Error) => setError(cause.message));
      }}
    >
      <summary>
        {period.coordinatorId
          ? "Đổi người phụ trách"
          : "Chưa có người phụ trách — phân công"}
      </summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const body = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          setError("");
          try {
            await api(`/internship-periods/${period.id}/coordinator`, {
              method: "POST",
              body: JSON.stringify(body),
            });
            onSaved();
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : "Không thể phân công.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Điều phối viên
          <select
            name="coordinatorId"
            required
            defaultValue={period.coordinatorId ?? ""}
          >
            <option value="" disabled>
              Chọn người phụ trách
            </option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.fullName} · {o.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          Lý do bàn giao
          <textarea name="reason" required minLength={3} maxLength={500} />
        </label>
        <p>
          Người phụ trách cũ sẽ mất quyền thao tác đợt này. Lịch thực tập không
          thay đổi.
        </p>
        {error && (
          <p role="alert" className="login-error">
            {error}
          </p>
        )}
        <button className="button secondary" disabled={busy}>
          {busy ? "Đang lưu…" : "Xác nhận phân công"}
        </button>
      </form>
    </details>
  );
}
function PeriodEditor({ onCreated }: { onCreated: () => void }) {
  const [weeks, setWeeks] = useState(6);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const payload = Object.fromEntries(form) as Record<string, unknown>;
      for (const key of [
        "registrationStartsAt",
        "registrationEndsAt",
        "startsAt",
        "endsAt",
        "gradingDeadline",
        "finalizationDeadline",
      ])
        payload[key] = new Date(String(payload[key])).toISOString();
      payload.weeklyDeadlines = Array.from({ length: weeks }, (_, i) => {
        const key = `deadline${i}`;
        const value = new Date(String(payload[key])).toISOString();
        delete payload[key];
        return value;
      });
      await api("/internship-periods", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOpen(false);
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo đợt.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card editor">
      <div className="section-title">
        <div>
          <h2>Tạo đợt thực tập</h2>
          <p>Thiết lập một lần trước khi công bố.</p>
        </div>
        <button className="button primary" onClick={() => setOpen(!open)}>
          {open ? "Đóng" : "＋ Tạo đợt"}
        </button>
      </div>
      {open && (
        <form onSubmit={submit}>
          <label>
            Tên đợt
            <input
              name="name"
              required
              minLength={3}
              maxLength={160}
              placeholder="Thực tập tốt nghiệp HK1 2026–2027"
            />
          </label>
          <div className="form-row">
            <label>
              Mở đăng ký
              <input
                name="registrationStartsAt"
                type="datetime-local"
                required
              />
            </label>
            <label>
              Đóng đăng ký
              <input name="registrationEndsAt" type="datetime-local" required />
            </label>
          </div>
          <div className="form-row">
            <label>
              Bắt đầu thực tập
              <input name="startsAt" type="datetime-local" required />
            </label>
            <label>
              Kết thúc thực tập
              <input name="endsAt" type="datetime-local" required />
            </label>
          </div>
          <div className="form-row">
            <label>
              Số tuần báo cáo
              <input
                name="weeklyReportCount"
                type="number"
                min="6"
                max="12"
                value={weeks}
                onChange={(event) =>
                  setWeeks(
                    Math.max(6, Math.min(12, Number(event.target.value) || 6)),
                  )
                }
                required
              />
            </label>
            <label>
              Ngưỡng tín chỉ (%)
              <input
                name="creditThresholdPercent"
                type="number"
                min="1"
                max="100"
                defaultValue="80"
                required
              />
            </label>
          </div>
          <details open>
            <summary>Hạn nộp báo cáo từng tuần</summary>
            <p>
              Chọn giờ địa phương. Các hạn phải tăng dần và nằm trong thời gian
              thực tập.
            </p>
            <div className="form-row">
              {Array.from({ length: weeks }, (_, i) => (
                <label key={i}>
                  Tuần {i + 1}
                  <input name={`deadline${i}`} type="datetime-local" required />
                </label>
              ))}
            </div>
          </details>
          <div className="form-row">
            <label>
              Hạn chấm điểm
              <input name="gradingDeadline" type="datetime-local" required />
            </label>
            <label>
              Hạn tổng kết
              <input
                name="finalizationDeadline"
                type="datetime-local"
                required
              />
            </label>
          </div>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Đang tạo…" : "Lưu bản nháp"}
          </button>
        </form>
      )}
    </section>
  );
}
function PublishPeriod({
  id,
  onPublished,
}: {
  id: string;
  onPublished: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      {error && <p role="alert">{error}</p>}
      {confirm ? (
        <>
          <p>Công bố sẽ khóa toàn bộ thời gian. Xác nhận?</p>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/internship-periods/${id}/publish`, {
                  method: "POST",
                });
                onPublished();
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : "Không thể công bố.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Công bố
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Quay lại
          </button>
        </>
      ) : (
        <button className="text-button" onClick={() => setConfirm(true)}>
          Công bố đợt
        </button>
      )}
    </div>
  );
}
export function ImportPanel({ onConfirmed }: { onConfirmed: () => void }) {
  const [type, setType] = useState<ImportType>("Students");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    batchId: string;
    total: number;
    valid: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/imports/preview?type=${type}`, {
        method: "POST",
        body,
        credentials: "same-origin",
        headers: workspaceHeaders(),
      });
      const data = await response.json();
      if (!response.ok)
        throw new ApiError(
          data?.message || "Không thể kiểm tra file.",
          response.status,
        );
      setPreview(data);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể kiểm tra file.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!preview || preview.errors.length) return;
    setBusy(true);
    try {
      await api(`/imports/${preview.batchId}/confirm`, { method: "POST" });
      setPreview(null);
      setFile(null);
      onConfirmed();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể import.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card editor import-panel">
      <h2>Import hồ sơ Excel</h2>
      <p>File chỉ tạo hồ sơ, không tự cấp tài khoản.</p>
      <form onSubmit={upload}>
        <div className="form-row">
          <label>
            Loại hồ sơ
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value as ImportType);
                setPreview(null);
              }}
            >
              <option value="Students">Sinh viên</option>
              <option value="Faculty">Giảng viên</option>
              <option value="Companies">Doanh nghiệp</option>
            </select>
          </label>
          <label>
            File .xlsx
            <input
              type="file"
              accept=".xlsx"
              required
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setPreview(null);
              }}
            />
          </label>
        </div>
        <a className="text-button" href={`/api/imports/template?type=${type}`}>
          Tải mẫu Excel
        </a>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button className="button secondary" disabled={busy}>
          {busy ? "Đang kiểm tra…" : "Kiểm tra file"}
        </button>
      </form>
      {preview && (
        <div className="import-preview">
          <strong>
            {preview.valid}/{preview.total} dòng hợp lệ
          </strong>
          {preview.errors.length ? (
            <ul>
              {preview.errors.map((item, index) => (
                <li key={`${item.row}-${index}`}>
                  Dòng {item.row}: {item.message}
                </li>
              ))}
            </ul>
          ) : (
            <button
              className="button primary"
              disabled={busy}
              onClick={confirm}
            >
              {busy ? "Đang import…" : "Xác nhận import"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

type ProfileType = "students" | "faculty" | "companies";
type Profile = {
  department?: { name: string };
  academicMajor?: { name: string };
  program?: { name: string };
  academicCohort?: { code: string };
  id: string;
  studentCode?: string;
  facultyCode?: string;
  name?: string;
  fullName?: string;
  email?: string;
  contactEmail?: string;
  userId?: string | null;
  representativeUserId?: string | null;
  isVerified?: boolean;
};
export function ProfilePanel({
  initialType = "students",
}: {
  initialType?: ProfileType;
}) {
  const [type, setType] = useState<ProfileType>(initialType);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Profile[]>([]);
  const [error, setError] = useState("");
  const load = () =>
    void api<Profile[]>(`/profiles/${type}`)
      .then(setItems)
      .catch((cause) => setError(cause.message));
  useEffect(load, [type]);
  const filtered = items.filter((item) =>
    [
      item.fullName,
      item.name,
      item.studentCode,
      item.facultyCode,
      item.email,
      item.contactEmail,
    ].some((value) =>
      value?.toLowerCase().includes(search.trim().toLowerCase()),
    ),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 20) - 1),
  );
  async function verify(item: Profile) {
    try {
      await api(
        `/${type === "students" ? "students" : "companies"}/${item.id}/verify`,
        { method: "POST" },
      );
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xác minh.");
    }
  }
  return (
    <section className="card profile-panel">
      <div className="section-title">
        <div>
          <h2>Hồ sơ học vụ</h2>
          <p>Import tạo hồ sơ trước, tài khoản được bàn giao riêng.</p>
        </div>
        <select
          aria-label="Loại hồ sơ danh mục"
          value={type}
          onChange={(event) => {
            setType(event.target.value as ProfileType);
            setItems([]);
            setSearch("");
            setPage(0);
          }}
        >
          <option value="students">Sinh viên</option>
          <option value="faculty">Giảng viên</option>
          <option value="companies">Doanh nghiệp</option>
        </select>
      </div>
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
      <ProfileEditor key={type} type={type} onSaved={load} />
      <label className="user-search">
        Tìm hồ sơ
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Tên, mã hoặc email"
        />
      </label>
      <p>
        {filtered.length} hồ sơ · Trang {currentPage + 1}/
        {Math.max(1, Math.ceil(filtered.length / 20))}
      </p>
      <button
        className="button secondary"
        disabled={currentPage === 0}
        onClick={() => setPage(currentPage - 1)}
      >
        Trang trước
      </button>{" "}
      <button
        className="button secondary"
        disabled={(currentPage + 1) * 20 >= filtered.length}
        onClick={() => setPage(currentPage + 1)}
      >
        Trang sau
      </button>
      <div className="table-scroll">
        <table className="users-table">
          <thead>
            <tr>
              <th>Hồ sơ</th>
              <th>Email</th>
              <th>Xác minh</th>
              <th>Tài khoản</th>
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice(currentPage * 20, (currentPage + 1) * 20)
              .map((item) => {
                const account =
                  type === "companies"
                    ? item.representativeUserId
                    : item.userId;
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.fullName || item.name}</strong>
                      <ProfileEditor
                        key={`${type}-${item.id}`}
                        type={type}
                        initial={item}
                        onSaved={load}
                      />
                      <small>
                        {item.studentCode || item.facultyCode || "Doanh nghiệp"}
                      </small>
                    </td>
                    <td>
                      {item.email || item.contactEmail}
                      <small>
                        {[
                          item.department?.name,
                          item.academicMajor?.name,
                          item.program?.name,
                          item.academicCohort?.code,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </td>
                    <td>
                      {type === "faculty" ? (
                        "—"
                      ) : (
                        <button
                          className="text-button"
                          onClick={() => verify(item)}
                        >
                          {item.isVerified ? "Đã xác minh" : "Xác minh"}
                        </button>
                      )}
                    </td>
                    <td>{account ? "Đã cấp" : "Chờ Admin cấp"}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {!items.length && (
        <p className="empty-state">Chưa có hồ sơ. Hãy import Excel trước.</p>
      )}
    </section>
  );
}
