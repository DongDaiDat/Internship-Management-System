"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import Link from "next/link";
import {
  StudentHome,
  StudentProfile,
  StudentInternshipPanel,
} from "./student-workspace-pages";

export type Period = {
  weeklyDeadlines?: string[];
  startsAt?: string;
  endsAt?: string;
  id: string;
  name: string;
  status: string;
  registrationStartsAt: string;
  registrationEndsAt: string;
  weeklyReportCount: number;
};
type Application = {
  id: string;
  status: string;
  period: Period;
  company: { name: string } | null;
  externalCompanyName: string | null;
  eligibilityReason: string | null;
  reviewNote: string | null;
  exceptionRequest: { status: string; reviewNote?: string } | null;
};
type Report = {
  id: string;
  weekNumber: number;
  content: string;
  status: string;
  mentorNote: string | null;
};
export type Internship = {
  id: string;
  period: Period;
  company: { name: string } | null;
  facultyMentor: { fullName: string };
  weeklyReports: Report[];
  finalReport: { content: string } | null;
  facultyEvaluation: { score: number } | null;
  finalGrade: { total: number; letterGrade: string; passed: boolean } | null;
};
export type StudentData = {
  profile: {
    department?: { name: string };
    academicMajor?: { name: string };
    program?: { name: string };
    academicCohort?: { code: string };
    email?: string;
    className?: string;
    fullName: string;
    studentCode: string;
    completedCredits: number;
    programCredits: number;
    isVerified: boolean;
  } | null;
  applications: Application[];
  internships: Internship[];
};
const labels: Record<string, string> = {
  Draft: "Bản nháp",
  Submitted: "Chờ xét duyệt",
  NeedsRevision: "Cần bổ sung",
  Approved: "Đã phê duyệt",
  Rejected: "Đã từ chối",
  Cancelled: "Đã hủy",
  Pending: "Chờ xử lý",
  Reviewed: "Đã nhận xét",
};
function registrationOpen(period: Period) {
  const now = Date.now();
  return (
    period.status === "Published" &&
    now >= Date.parse(period.registrationStartsAt) &&
    now <= Date.parse(period.registrationEndsAt)
  );
}

export type StudentView =
  | "overview"
  | "profile"
  | "registration"
  | "applications"
  | "reports"
  | "documents"
  | "results";
export function StudentPortal({ view = "overview" }: { view?: StudentView }) {
  const [selectedId, setSelectedId] = useState("");
  const [reportDirty, setReportDirty] = useState(false);
  const [data, setData] = useState<StudentData | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [external, setExternal] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [mine, availablePeriods, availableCompanies] = await Promise.all([
      api<StudentData>("/internships/mine"),
      view === "registration"
        ? api<Period[]>("/internship-periods")
        : Promise.resolve([]),
      view === "registration"
        ? api<{ id: string; name: string }[]>("/companies")
        : Promise.resolve([]),
    ]);
    setData(mine);
    setPeriods(availablePeriods);
    setCompanies(availableCompanies);
  }, [view]);
  useEffect(() => {
    void load().catch((cause: Error) => setError(cause.message));
  }, [load]);
  async function mutate(path: string, body: object, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      setNotice(message);
      setCancelId(null);
      await load();
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể lưu. Vui lòng thử lại.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (
      await mutate(
        "/internship-applications",
        Object.fromEntries(new FormData(form)),
        "Đã gửi hồ sơ đăng ký. Xem kết quả tại mục Hồ sơ đăng ký.",
      )
    )
      form.reset();
  }
  return (
    <section className="student-portal" aria-label="Hồ sơ thực tập của tôi">
      {error && (
        <div className="login-error" role="alert">
          {error}{" "}
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void load()
                .then(() => setError(""))
                .catch((cause: Error) => setError(cause.message))
            }
          >
            Tải lại
          </button>
        </div>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!data ? (
        <p className="empty-state" role="status">
          Đang tải hồ sơ…
        </p>
      ) : !data.profile ? (
        <section className="card empty-state">
          <h2>Chưa có hồ sơ sinh viên</h2>
          <p>Liên hệ điều phối viên để liên kết tài khoản với hồ sơ học vụ.</p>
        </section>
      ) : (
        <>
          {view === "overview" && <StudentHome data={data} />}
          {view === "profile" && (
            <StudentProfile profile={data.profile} onSaved={load} />
          )}
          {view === "registration" && (
            <section className="card editor">
              <h2>Đăng ký thực tập</h2>
              <Link
                className="text-button"
                href="/workspace/student/applications"
              >
                Xem hồ sơ đã gửi →
              </Link>
              <p>
                Chọn đợt và nơi thực tập. Hồ sơ học vụ được kiểm tra khi gửi.
              </p>
              {data.internships.some(
                (i) =>
                  !i.period.endsAt || Date.parse(i.period.endsAt) >= Date.now(),
              ) ? (
                <div className="info-note">
                  <p>
                    Bạn đã có một kỳ thực tập đang hiệu lực. Theo dõi và nộp báo
                    cáo tại mục Báo cáo thực tập.
                  </p>
                  <Link
                    className="button secondary"
                    href="/workspace/student/reports"
                  >
                    Đến báo cáo thực tập
                  </Link>
                </div>
              ) : !periods.some(registrationOpen) ? (
                <p className="empty-state">Chưa có đợt đang nhận đăng ký.</p>
              ) : (
                <form onSubmit={register}>
                  <fieldset disabled={busy}>
                    <label>
                      Đợt thực tập
                      <select
                        aria-label="Đợt thực tập"
                        name="periodId"
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Chọn đợt đang mở
                        </option>
                        {periods.filter(registrationOpen).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nơi thực tập
                      <select
                        value={external ? "external" : "listed"}
                        onChange={(e) =>
                          setExternal(e.target.value === "external")
                        }
                      >
                        <option value="listed">Doanh nghiệp đã xác minh</option>
                        <option value="external">Công ty tôi tự tìm</option>
                      </select>
                    </label>
                    {external ? (
                      <>
                        <label>
                          Tên công ty
                          <input
                            name="externalCompanyName"
                            required
                            minLength={2}
                            maxLength={160}
                          />
                        </label>
                        <label>
                          Người liên hệ
                          <input
                            name="externalCompanyContact"
                            required
                            maxLength={160}
                          />
                        </label>
                        <label>
                          Email liên hệ
                          <input
                            name="externalCompanyEmail"
                            type="email"
                            required
                            maxLength={254}
                          />
                        </label>
                        <p>Khoa sẽ xác minh công ty trước khi duyệt hồ sơ.</p>
                      </>
                    ) : (
                      <label>
                        Doanh nghiệp
                        <select
                          aria-label="Doanh nghiệp"
                          name="companyId"
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Chọn doanh nghiệp
                          </option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      Vị trí thực tập
                      <input
                        name="positionTitle"
                        required
                        minLength={2}
                        maxLength={160}
                        placeholder="Ví dụ: Lập trình viên frontend"
                      />
                    </label>
                    <button className="button primary">
                      {busy ? "Đang gửi…" : "Gửi đăng ký"}
                    </button>
                  </fieldset>
                </form>
              )}
            </section>
          )}
          {view === "applications" && (
            <section className="card">
              <h2>Hồ sơ đã gửi</h2>
              {!data.applications.length && (
                <p className="empty-state">Bạn chưa gửi đăng ký thực tập.</p>
              )}
              {data.applications.map((a) => (
                <article className="portal-entry" key={a.id}>
                  <h3>{a.period.name}</h3>
                  <p>{a.company?.name || a.externalCompanyName}</p>
                  <span className="subtle-badge">
                    {labels[a.status] || "Đang xử lý"}
                  </span>
                  {a.eligibilityReason && <p>{a.eligibilityReason}</p>}
                  {a.reviewNote && (
                    <p className="notice">Kết luận của khoa: {a.reviewNote}</p>
                  )}
                  {a.exceptionRequest ? (
                    <p>
                      Ngoại lệ:{" "}
                      {labels[a.exceptionRequest.status] || "Đang xử lý"}
                    </p>
                  ) : (
                    a.eligibilityReason &&
                    a.status === "Submitted" && (
                      <details>
                        <summary>Gửi yêu cầu ngoại lệ</summary>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void mutate(
                              `/internship-applications/${a.id}/exceptions`,
                              Object.fromEntries(new FormData(e.currentTarget)),
                              "Đã gửi yêu cầu ngoại lệ đến Trưởng khoa.",
                            );
                          }}
                        >
                          <label>
                            Lý do
                            <textarea
                              name="reason"
                              minLength={10}
                              maxLength={1000}
                              required
                            />
                          </label>
                          <button className="button secondary" disabled={busy}>
                            Gửi yêu cầu
                          </button>
                        </form>
                      </details>
                    )
                  )}
                  {registrationOpen(a.period) &&
                    ["Draft", "Submitted", "NeedsRevision"].includes(
                      a.status,
                    ) &&
                    (cancelId === a.id ? (
                      <div className="notice">
                        <p>Xác nhận hủy hồ sơ đăng ký này?</p>
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() =>
                            void mutate(
                              `/internship-applications/${a.id}/cancel`,
                              {},
                              "Đã hủy đăng ký.",
                            )
                          }
                        >
                          Xác nhận hủy
                        </button>{" "}
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => setCancelId(null)}
                        >
                          Giữ hồ sơ
                        </button>
                      </div>
                    ) : (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => setCancelId(a.id)}
                      >
                        Hủy đăng ký
                      </button>
                    ))}
                </article>
              ))}
            </section>
          )}
          {["reports", "documents", "results"].includes(view) &&
            (data.internships.length ? (
              <>
                <div className="student-context-bar">
                  <label>
                    Kỳ thực tập
                    <select
                      aria-label="Kỳ thực tập"
                      value={selectedId || data.internships[0].id}
                      onChange={(e) => {
                        if (
                          reportDirty &&
                          !window.confirm(
                            "Nội dung chưa được lưu. Bạn muốn đổi kỳ thực tập?",
                          )
                        )
                          return;
                        setReportDirty(false);
                        setSelectedId(e.target.value);
                      }}
                    >
                      {data.internships.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.period.name} ·{" "}
                          {i.company?.name || "Chưa có doanh nghiệp"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="student-context-hint">
                    Chọn kỳ để xem đúng báo cáo và kết quả.
                  </span>
                </div>
                <StudentInternshipPanel
                  key={selectedId || data.internships[0].id}
                  internship={
                    data.internships.find((i) => i.id === selectedId) ||
                    data.internships[0]
                  }
                  view={view as "reports" | "documents" | "results"}
                  busy={busy}
                  mutate={mutate}
                  reload={load}
                  onDirtyChange={setReportDirty}
                />
              </>
            ) : (
              <section className="card empty-state">
                <h2>Chưa có kỳ thực tập</h2>
                <p>
                  Các mục này sẵn sàng sau khi hồ sơ đăng ký được khoa phê
                  duyệt.
                </p>
                <Link
                  className="button primary"
                  href="/workspace/student/applications"
                >
                  Xem hồ sơ đăng ký
                </Link>
              </section>
            ))}
        </>
      )}
    </section>
  );
}
