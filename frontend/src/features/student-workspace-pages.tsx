"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { FilePanel } from "./file-panel";
import { WorkspaceIcon } from "./workspace-shell";
import type { Internship, StudentData } from "./student-portal";

const root = "/workspace/student/";
const date = (value?: string) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Chưa cấu hình";
const reportLabel = (status?: string) =>
  status === "Reviewed"
    ? "Đã nhận xét"
    : status === "NeedsRevision"
      ? "Cần bổ sung"
      : status
        ? "Đã nộp"
        : "Chưa nộp";

export function StudentHome({ data }: { data: StudentData }) {
  const profile = data.profile!;
  const internship =
    data.internships.find((i) => !i.finalGrade) || data.internships[0];
  const pending = data.applications.filter((a) =>
    ["Submitted", "NeedsRevision"].includes(a.status),
  ).length;
  const submitted = internship?.weeklyReports.length || 0;
  const weeks = internship?.period.weeklyReportCount || 0;
  const nextWeek = internship
    ? Array.from({ length: weeks }, (_, i) => i + 1).find(
        (w) =>
          !internship.weeklyReports.some((r) => r.weekNumber === w) ||
          internship.weeklyReports.some(
            (r) => r.weekNumber === w && r.status === "NeedsRevision",
          ),
      )
    : undefined;
  const deadline = nextWeek
    ? internship?.period.weeklyDeadlines?.[nextWeek - 1]
    : undefined;
  return (
    <div className="student-home">
      <section className="student-welcome">
        <div>
          <span className="eyebrow">CỔNG THỰC TẬP SINH VIÊN</span>
          <h2>Xin chào, {profile.fullName}!</h2>
          <p>Theo dõi kỳ thực tập và xử lý công việc của bạn tại đây.</p>
          <span>
            {profile.studentCode} ·{" "}
            {profile.academicCohort?.code || "Chưa gán khóa"}
          </span>
        </div>
        <Link
          className="button primary"
          href={
            root +
            (internship ? "reports" : pending ? "applications" : "registration")
          }
        >
          {internship
            ? "Mở báo cáo thực tập"
            : pending
              ? "Theo dõi hồ sơ"
              : "Đăng ký thực tập"}{" "}
          →
        </Link>
      </section>
      <div className="student-metrics">
        {[
          [
            "Tín chỉ hoàn thành",
            `${profile.completedCredits}/${profile.programCredits}`,
            "Theo hồ sơ học vụ",
          ],
          ["Hồ sơ chờ duyệt", String(pending), "Đang được khoa xử lý"],
          [
            "Báo cáo đã nộp",
            `${submitted}/${weeks}`,
            internship ? internship.period.name : "Chưa có kỳ thực tập",
          ],
          [
            "Kết quả",
            internship?.finalGrade
              ? `${internship.finalGrade.total}/10`
              : "Chưa chốt",
            internship?.finalGrade?.letterGrade ||
              "Hiển thị sau khi khoa chốt điểm",
          ],
        ].map(([label, value, hint]) => (
          <section className="card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </section>
        ))}
      </div>
      <div className="student-home-grid">
        <section className="card student-section">
          <h2>Việc cần làm</h2>
          {!profile.isVerified && (
            <div className="student-action-row">
              <WorkspaceIcon name="people" />
              <div>
                <strong>Hoàn thiện hồ sơ học vụ</strong>
                <p>Hồ sơ đang chờ khoa xác minh.</p>
              </div>
              <Link href={root + "profile"}>Xem hồ sơ →</Link>
            </div>
          )}
          {internship && !internship.finalGrade ? (
            <>
              {nextWeek && (
                <div className="student-action-row">
                  <WorkspaceIcon name="file" />
                  <div>
                    <strong>Báo cáo tuần {nextWeek}</strong>
                    <p>
                      {deadline
                        ? `${Date.parse(deadline) < Date.now() ? "Đã quá hạn" : "Hạn nộp"}: ${date(deadline)}`
                        : "Xem nội dung và nhận xét của giảng viên."}
                    </p>
                  </div>
                  <Link href={root + "reports"}>Mở báo cáo →</Link>
                </div>
              )}
              {!internship.finalReport && (
                <div className="student-action-row">
                  <WorkspaceIcon name="cap" />
                  <div>
                    <strong>Báo cáo cuối kỳ</strong>
                    <p>Hạn nộp: {date(internship.period.endsAt)}</p>
                  </div>
                  <Link href={root + "reports"}>Chuẩn bị →</Link>
                </div>
              )}
              {!nextWeek && internship.finalReport && (
                <p>
                  Đã nộp đủ nội dung báo cáo. Theo dõi nhận xét và kết quả từ
                  khoa.
                </p>
              )}
            </>
          ) : (
            <div className="student-action-row">
              <WorkspaceIcon name="check" />
              <div>
                <strong>
                  {internship?.finalGrade
                    ? "Kết quả đã sẵn sàng"
                    : pending
                      ? "Hồ sơ đang được xét duyệt"
                      : "Bắt đầu kỳ thực tập"}
                </strong>
                <p>
                  {internship?.finalGrade
                    ? "Xem điểm tổng kết của kỳ thực tập."
                    : pending
                      ? "Theo dõi phản hồi hoặc yêu cầu bổ sung của khoa."
                      : "Chọn đợt phù hợp và gửi hồ sơ đăng ký."}
                </p>
              </div>
              <Link
                href={
                  root +
                  (internship?.finalGrade
                    ? "results"
                    : pending
                      ? "applications"
                      : "registration")
                }
              >
                Xem chi tiết →
              </Link>
            </div>
          )}
        </section>
        <section className="card student-section">
          <h2>Kỳ thực tập hiện tại</h2>
          {internship ? (
            <>
              <span className="student-pill">
                {internship.finalGrade ? "Đã tổng kết" : "Đã được phân công"}
              </span>
              <h3>{internship.period.name}</h3>
              <dl className="student-facts">
                <div>
                  <dt>Doanh nghiệp</dt>
                  <dd>{internship.company?.name || "Chưa cập nhật"}</dd>
                </div>
                <div>
                  <dt>Giảng viên hướng dẫn</dt>
                  <dd>{internship.facultyMentor.fullName}</dd>
                </div>
              </dl>
              <div className="student-progress-caption">
                <span>Tiến độ nộp báo cáo</span>
                <strong>
                  {submitted}/{weeks} tuần
                </strong>
              </div>
              <progress
                aria-label="Tiến độ báo cáo"
                value={submitted}
                max={weeks || 1}
              />
              <Link className="text-button" href={root + "documents"}>
                Tệp báo cáo và minh chứng →
              </Link>
            </>
          ) : (
            <p>
              Thông tin doanh nghiệp và giảng viên sẽ hiển thị sau khi hồ sơ
              được phê duyệt.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export function StudentProfile({
  profile,
  onSaved,
}: {
  profile: NonNullable<StudentData["profile"]>;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  return (
    <section className="card student-profile-card">
      <h2 className="student-section-heading">Thông tin sinh viên</h2>
      <div className="student-profile-layout">
        <aside className="student-identity">
          <div className="student-avatar" aria-hidden="true">
            {profile.fullName
              .trim()
              .split(/\s+/)
              .slice(-2)
              .map((n) => n[0])
              .join("")}
          </div>
          <h3>{profile.fullName}</h3>
          <p>{profile.studentCode}</p>
          <span
            className={`student-pill ${profile.isVerified ? "success" : "warning"}`}
          >
            {profile.isVerified ? "Hồ sơ đã xác minh" : "Chờ khoa xác minh"}
          </span>
          <p className="student-profile-help">
            Thông tin học vụ do khoa quản lý. Liên hệ điều phối viên nếu cần
            điều chỉnh.
          </p>
        </aside>
        <div>
          <dl className="student-profile-fields">
            {[
              ["Khoa", profile.department?.name],
              ["Ngành học", profile.academicMajor?.name],
              ["Chương trình", profile.program?.name],
              ["Khóa", profile.academicCohort?.code],
              ["Lớp quản lý", profile.className],
              [
                "Tín chỉ hoàn thành",
                `${profile.completedCredits} / ${profile.programCredits}`,
              ],
              ["Email liên hệ", profile.email],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "Chưa cập nhật"}</dd>
              </div>
            ))}
          </dl>
          <form
            className="student-contact-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              setMessage("");
              const email = new FormData(e.currentTarget).get("email");
              try {
                await api("/students/me/contact", {
                  method: "POST",
                  body: JSON.stringify({ email }),
                });
                await onSaved();
                setMessage("Đã cập nhật email liên hệ.");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Không thể lưu email.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>Cập nhật liên hệ</h3>
            <p>Email này dùng để liên hệ, không thay đổi email đăng nhập.</p>
            <div className="student-contact-actions">
              <label>
                Email liên hệ
                <input
                  type="email"
                  name="email"
                  defaultValue={profile.email || ""}
                  required
                  maxLength={254}
                />
              </label>
              <button className="button primary" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu thông tin"}
              </button>
            </div>
            {error && (
              <p role="alert" className="login-error">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="notice">
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}

type Mutation = (
  path: string,
  body: object,
  message: string,
) => Promise<boolean>;
export function StudentInternshipPanel({
  internship: item,
  view,
  busy,
  mutate,
  reload,
  onDirtyChange,
}: {
  internship: Internship;
  view: "reports" | "documents" | "results";
  busy: boolean;
  mutate: Mutation;
  reload: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [selected, setSelected] = useState<number | "final">(
    () =>
      item.weeklyReports.find((r) => r.status === "NeedsRevision")
        ?.weekNumber ||
      Array.from(
        { length: item.period.weeklyReportCount },
        (_, i) => i + 1,
      ).find((w) => !item.weeklyReports.some((r) => r.weekNumber === w)) ||
      1,
  );
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const navigate = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        anchor &&
        !window.confirm("Nội dung chưa được lưu. Bạn muốn rời trang báo cáo?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  const report =
    typeof selected === "number"
      ? item.weeklyReports.find((r) => r.weekNumber === selected)
      : undefined;
  const deadline =
    selected === "final"
      ? item.period.endsAt
      : item.period.weeklyDeadlines?.[selected - 1];
  const outsideWindow =
    !deadline ||
    Date.now() > Date.parse(deadline) ||
    (!!item.period.startsAt && Date.now() < Date.parse(item.period.startsAt));
  const locked =
    !!item.finalGrade ||
    (selected === "final"
      ? !!item.facultyEvaluation
      : report?.status === "Reviewed") ||
    outsideWindow;
  const content =
    selected === "final" ? item.finalReport?.content : report?.content;
  const targets = item.finalGrade
    ? []
    : [
        ...item.weeklyReports
          .filter((r) => r.status !== "Reviewed")
          .map((r) => ({
            label: `Báo cáo tuần ${r.weekNumber}`,
            path: `/internships/${item.id}/weekly-reports/${r.weekNumber}/file`,
          })),
        ...(item.finalReport && !item.facultyEvaluation
          ? [
              {
                label: "Báo cáo cuối",
                path: `/internships/${item.id}/final-report/file`,
              },
            ]
          : []),
      ];
  if (view === "documents")
    return (
      <section className="card student-section">
        <h2>Tệp báo cáo và minh chứng</h2>
        <p>
          Lưu nội dung tại mục Báo cáo thực tập trước khi đính kèm PDF. Mỗi tệp
          tối đa 10 MB.
        </p>
        <FilePanel
          internshipId={item.id}
          targets={targets}
          onSaved={() => void reload()}
          initiallyOpen
        />
        <Link className="text-button" href={root + "reports"}>
          ← Về báo cáo thực tập
        </Link>
      </section>
    );
  if (view === "results")
    return (
      <section className="card student-section">
        <h2>Kết quả thực tập</h2>
        <p>
          {item.period.name} · {item.company?.name || "Chưa có doanh nghiệp"}
        </p>
        {item.finalGrade ? (
          <div className="student-grade-result">
            <span>ĐIỂM TỔNG KẾT</span>
            <strong>
              {item.finalGrade.total}
              <small>/10</small>
            </strong>
            <span
              className={`student-pill ${item.finalGrade.passed ? "success" : "warning"}`}
            >
              {item.finalGrade.letterGrade} ·{" "}
              {item.finalGrade.passed ? "Đạt" : "Chưa đạt"}
            </span>
            <p>Kết quả đã được khoa chốt và lưu vào lịch sử.</p>
          </div>
        ) : (
          <div className="student-awaiting">
            <WorkspaceIcon name="cap" />
            <h3>Chưa có điểm tổng kết</h3>
            <p>
              {item.facultyEvaluation
                ? "Giảng viên đã chấm điểm. Kết quả sẽ hiển thị khi khoa hoàn tất chốt điểm."
                : "Giảng viên và doanh nghiệp đang đánh giá quá trình thực tập."}
            </p>
            <Link href={root + "reports"} className="button secondary">
              Kiểm tra báo cáo
            </Link>
          </div>
        )}
        <p className="info-note">
          Điểm tổng kết gồm 50% đánh giá doanh nghiệp và 50% đánh giá giảng viên
          (bao gồm báo cáo cuối).
        </p>
      </section>
    );
  return (
    <section className="card student-report-card">
      <div className="student-section-heading">
        <h2>Báo cáo thực tập</h2>
        <span>
          {item.weeklyReports.length}/{item.period.weeklyReportCount} tuần đã
          nộp
        </span>
      </div>
      <div className="student-report-layout">
        <nav className="student-week-list" aria-label="Chọn báo cáo">
          {Array.from({ length: item.period.weeklyReportCount + 1 }, (_, i) =>
            i < item.period.weeklyReportCount ? i + 1 : ("final" as const),
          ).map((week) => {
            const current = item.weeklyReports.find(
              (r) => r.weekNumber === week,
            );
            return (
              <button
                key={week}
                type="button"
                disabled={busy}
                aria-pressed={selected === week}
                onClick={() => {
                  if (
                    dirty &&
                    !window.confirm(
                      "Nội dung chưa được lưu. Bạn muốn chuyển sang báo cáo khác?",
                    )
                  )
                    return;
                  setDirty(false);
                  setSelected(week);
                }}
              >
                <span>
                  {week === "final"
                    ? "Báo cáo cuối kỳ"
                    : `Tuần ${String(week).padStart(2, "0")}`}
                </span>
                <small>
                  {week === "final"
                    ? item.finalReport
                      ? "Đã nộp"
                      : "Chưa nộp"
                    : reportLabel(current?.status)}
                </small>
              </button>
            );
          })}
        </nav>
        <div className="student-report-editor" key={`${item.id}-${selected}`}>
          <div className="section-title">
            <h3>
              {selected === "final"
                ? "Báo cáo cuối kỳ"
                : `Báo cáo tuần ${selected}`}
            </h3>
            <span className="student-pill">
              {selected === "final"
                ? item.finalReport
                  ? "Đã nộp"
                  : "Chưa nộp"
                : reportLabel(report?.status)}
            </span>
          </div>
          <p className="student-deadline">Hạn nộp: {date(deadline)}</p>
          {report?.mentorNote && (
            <div className="notice">
              <strong>Nhận xét của giảng viên</strong>
              <p>{report.mentorNote}</p>
            </div>
          )}
          {locked ? (
            <>
              <p className="info-note">
                {item.finalGrade
                  ? "Điểm đã chốt. Báo cáo được lưu để tra cứu."
                  : outsideWindow
                    ? "Ngoài thời gian nộp báo cáo. Liên hệ điều phối viên nếu cần hỗ trợ."
                    : "Báo cáo đã được đánh giá và khóa chỉnh sửa."}
              </p>
              <div className="report-content student-readonly">
                {content || "Chưa có nội dung báo cáo."}
              </div>
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const value = new FormData(e.currentTarget).get("content");
                const ok = await mutate(
                  `/internships/${item.id}/${selected === "final" ? "final-report" : "weekly-reports"}`,
                  selected === "final"
                    ? { content: value }
                    : { weekNumber: selected, content: value },
                  selected === "final"
                    ? "Đã lưu báo cáo cuối kỳ."
                    : `Đã lưu báo cáo tuần ${selected}.`,
                );
                if (ok) setDirty(false);
              }}
            >
              <label>
                Nội dung công việc và kết quả
                <textarea
                  name="content"
                  defaultValue={content || ""}
                  onChange={() => setDirty(true)}
                  minLength={selected === "final" ? 100 : 20}
                  maxLength={selected === "final" ? 10000 : 5000}
                  rows={12}
                  required
                  placeholder="Mô tả công việc đã thực hiện, kết quả đạt được và những vấn đề cần hỗ trợ…"
                />
              </label>
              <div className="student-report-actions">
                <small>
                  {dirty
                    ? "Có thay đổi chưa lưu"
                    : `Tối thiểu ${selected === "final" ? 100 : 20} ký tự.`}
                </small>
                <button className="button primary" disabled={busy}>
                  {busy
                    ? "Đang lưu…"
                    : content
                      ? "Cập nhật báo cáo"
                      : "Nộp báo cáo"}
                </button>
              </div>
            </form>
          )}
          <Link className="text-button" href={root + "documents"}>
            Đính kèm hoặc xem tệp PDF →
          </Link>
        </div>
      </div>
    </section>
  );
}
