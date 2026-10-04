"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { WorkspaceShell } from "./workspace-shell";
import type { CurrentUser } from "../lib/api";
import {
  emptyDraft,
  parseDraft,
  ReportDraft,
  validateReport,
} from "../lib/weekly-report";
type View = "overview" | "reports" | "internship";
const reports = [
  {
    week: 5,
    title: "Xây dựng giao diện quản lý người dùng",
    date: "04/09/2026",
    hours: 40,
  },
  {
    week: 4,
    title: "Tích hợp API và xử lý dữ liệu",
    date: "28/08/2026",
    hours: 40,
  },
  {
    week: 3,
    title: "Phát triển các thành phần giao diện",
    date: "21/08/2026",
    hours: 36,
  },
];
function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    file: "M14 2H5v20h14V7zM14 2v6h5M8 13h8M8 17h5",
    case: "M3 7h18v14H3zM8 7V3h8v4M3 12l9 3 9-3",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    check: "m5 12 4 4L19 6",
    clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    cap: "m2 9 10-5 10 5-10 5ZM6 11v6c4 3 8 3 12 0v-6M22 9v7",
    menu: "M4 6h16M4 12h16M4 18h16",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.file} />
    </svg>
  );
}
export function StudentWorkspace({
  user,
  onLogout,
  loggingOut = false,
}: {
  user?: CurrentUser;
  onLogout?: () => void;
  loggingOut?: boolean;
}) {
  const storageKey = user
    ? `internship-demo-report-v1:${user.id}`
    : "internship-demo-report-v1";
  const displayName = user?.fullName || "Nguyễn Minh Anh";
  const [view, setView] = useState<View>("overview");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ReportDraft>({ ...emptyDraft });
  const [errors, setErrors] = useState<ReturnType<typeof validateReport>>({});
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  const [preview, setPreview] = useState(false);
  const [selectedReport, setSelectedReport] = useState<number | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = parseDraft(raw);
        if (saved) setDraft(saved);
        else
          setNotice("Bản nháp cũ không hợp lệ. Bạn có thể tạo bản nháp mới.");
      }
    } catch {
      setNotice(
        "Trình duyệt đang chặn lưu trữ. Bạn vẫn có thể viết báo cáo trong phiên này.",
      );
    }
  }, [storageKey]);
  function navigate(next: View) {
    setView(next);
    setEditing(false);
    setSelectedReport(null);
    setNotice("");
  }
  function writeReport() {
    setView("reports");
    setEditing(true);
    setPreview(false);
    setNotice("");
    setErrors({});
  }
  function update(field: keyof ReportDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: field === "week" ? Number(value) : value,
    }));
    setPreview(false);
    setNotice("");
  }
  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setNotice(
        "Đã lưu nháp trên trình duyệt này. Báo cáo chưa được gửi cho người hướng dẫn.",
      );
    } catch {
      setNotice(
        "Không thể lưu nháp. Hãy giữ trang mở và sao chép nội dung để tránh mất dữ liệu.",
      );
    }
  }
  const filtered = reports.filter((report) =>
    `${report.title} tuần ${report.week}`
      .toLocaleLowerCase("vi")
      .includes(filter.trim().toLocaleLowerCase("vi")),
  );
  return (
    <WorkspaceShell
      title={
        view === "overview"
          ? "Tổng quan"
          : view === "reports"
            ? "Báo cáo tuần"
            : "Kỳ thực tập của tôi"
      }
      subtitle="Hành trình thực tập của bạn"
      name={displayName}
      role="Sinh viên minh họa"
      current={view}
      navigation={[
        {
          key: "overview",
          label: "Tổng quan",
          icon: "grid",
          href: "/demo#overview",
        },
        {
          key: "internship",
          label: "Kỳ thực tập của tôi",
          icon: "calendar",
          href: "/demo#internship",
        },
        {
          key: "reports",
          label: "Báo cáo tuần",
          icon: "file",
          href: "/demo#reports",
        },
      ]}
      onNavigate={(key) => navigate(key as View)}
      logout={
        user ? (
          <button
            className="text-button"
            disabled={loggingOut}
            onClick={onLogout}
          >
            Đăng xuất
          </button>
        ) : (
          <Link className="button secondary" href="/">
            Đăng nhập
          </Link>
        )
      }
    >
      <div className="demo-note">
        <span>BẢN TRẢI NGHIỆM</span> Dữ liệu minh họa · Bản nháp chỉ lưu trên
        trình duyệt, chưa gửi lên hệ thống.
      </div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">HÀNH TRÌNH THỰC TẬP CỦA BẠN</p>
          <h1>
            {view === "overview"
              ? `Chào ${displayName.split(" ").slice(-2).join(" ")}, tiếp tục tiến lên!`
              : view === "reports"
                ? "Báo cáo tuần"
                : "Kỳ thực tập của tôi"}
          </h1>
          <p>
            {view === "overview"
              ? "Một nơi để theo dõi tiến độ và tập trung vào điều quan trọng."
              : view === "reports"
                ? "Ghi lại công việc, điều đã học và kế hoạch cho chặng tiếp theo."
                : "Thông tin, người đồng hành và các cột mốc trong kỳ thực tập."}
          </p>
        </div>
        {!editing && (
          <button className="button primary" onClick={writeReport}>
            ＋ Viết báo cáo
          </button>
        )}
      </div>
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {view === "overview" && (
        <>
          <section className="hero">
            <div className="hero-copy">
              <span className="hero-tag">● ĐANG THỰC TẬP</span>
              <h2>
                Học từ thực tế.
                <br />
                Trưởng thành mỗi ngày.
              </h2>
              <p>Frontend Developer Intern · Công ty Cổ phần FPT Software</p>
              <button
                className="button hero-button"
                onClick={() => navigate("internship")}
              >
                Xem kỳ thực tập <Icon name="arrow" />
              </button>
            </div>
            <div className="hero-progress">
              <div className="progress-ring">
                <div>
                  <strong>
                    6<span>/12</span>
                  </strong>
                  <small>TUẦN THỰC TẬP</small>
                </div>
              </div>
              <p>Bạn đã đi được nửa chặng đường</p>
              <span>03/08 — 25/10/2026</span>
            </div>
            <div className="hero-decoration" aria-hidden="true" />
          </section>
          <div className="stats">
            <Stat
              icon="clock"
              value="196"
              unit="giờ"
              label="Thời gian đã ghi nhận"
              detail="Mục tiêu minh họa: 480 giờ"
            />
            <Stat
              icon="file"
              value="5"
              unit="/ 12"
              label="Báo cáo đã được duyệt"
              detail="Lịch sử bên dưới: 3 báo cáo gần nhất"
            />
            <Stat
              icon="check"
              value="3"
              unit="/ 6"
              label="Cột mốc hoàn thành"
              detail="Sắp tới: đánh giá giữa kỳ"
            />
          </div>
          <div className="dashboard-grid">
            <section className="card">
              <div className="section-title">
                <h2>Việc cần làm</h2>
                <span className="subtle-badge">2 việc sắp tới</span>
              </div>
              <div className="task">
                <span className="task-icon purple">
                  <Icon name="file" />
                </span>
                <div>
                  <strong>Hoàn thành báo cáo tuần 6</strong>
                  <p>Chia sẻ tiến độ với người hướng dẫn</p>
                  <span className="deadline">Hạn nộp · 13/09/2026</span>
                </div>
                <button className="text-button" onClick={writeReport}>
                  Bắt đầu <Icon name="arrow" />
                </button>
              </div>
              <div className="task">
                <span className="task-icon peach">
                  <Icon name="case" />
                </span>
                <div>
                  <strong>Chuẩn bị đánh giá giữa kỳ</strong>
                  <p>Tổng hợp kết quả và mục tiêu đã đạt</p>
                  <span className="muted">Dự kiến · 18/09/2026</span>
                </div>
                <button
                  className="icon-button"
                  aria-label="Xem thông tin đánh giá giữa kỳ"
                  onClick={() => navigate("internship")}
                >
                  <Icon name="arrow" />
                </button>
              </div>
            </section>
            <section className="card mentor-card">
              <div className="section-title">
                <h2>Người đồng hành</h2>
                <Icon name="cap" />
              </div>
              <div className="mentor">
                <span className="avatar lavender">TH</span>
                <div>
                  <strong>ThS. Trần Thu Hà</strong>
                  <p>Giảng viên hướng dẫn</p>
                </div>
              </div>
              <div className="mentor">
                <span className="avatar mint">QD</span>
                <div>
                  <strong>Lê Quốc Duy</strong>
                  <p>Hướng dẫn tại doanh nghiệp</p>
                </div>
              </div>
              <p className="mentor-note">
                Thông tin minh họa. Kênh liên hệ sẽ hiển thị khi có phân công
                chính thức.
              </p>
            </section>
          </div>
          <section className="card">
            <div className="section-title">
              <div>
                <h2>Báo cáo gần đây</h2>
                <p>Những bước tiến bạn đã ghi lại</p>
              </div>
              <button
                className="text-button"
                onClick={() => navigate("reports")}
              >
                Xem lịch sử <Icon name="arrow" />
              </button>
            </div>
            <ReportList
              items={reports}
              onSelect={(week) => {
                navigate("reports");
                setSelectedReport(week);
              }}
            />
          </section>
        </>
      )}
      {view === "reports" && !editing && (
        <section className="card">
          <div className="section-title">
            <h2>Lịch sử báo cáo minh họa</h2>
            <label className="search-label">
              <span className="sr-only">Tìm báo cáo</span>
              <input
                type="search"
                placeholder="Tìm theo nội dung, tuần…"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </label>
          </div>
          <ReportList items={filtered} onSelect={setSelectedReport} />
          {filtered.length === 0 && (
            <div className="empty-state">
              <Icon name="file" />
              <h3>Không tìm thấy báo cáo</h3>
              <p>Thử tên công việc khác hoặc xóa từ khóa tìm kiếm.</p>
              <button
                className="button secondary"
                onClick={() => setFilter("")}
              >
                Xóa tìm kiếm
              </button>
            </div>
          )}
          {selectedReport !== null && (
            <div className="report-detail">
              <h3>Báo cáo tuần {selectedReport}</h3>
              <p>
                {reports.find((item) => item.week === selectedReport)?.title}
              </p>
              <p>
                Đây là bản ghi minh họa; nội dung chi tiết và nhận xét chưa được
                kết nối với backend.
              </p>
              <button
                className="text-button"
                onClick={() => setSelectedReport(null)}
              >
                Đóng chi tiết
              </button>
            </div>
          )}
        </section>
      )}
      {view === "reports" && editing && (
        <section className="card editor">
          <div className="section-title">
            <div>
              <h2>Viết báo cáo mới</h2>
              <p>Lưu nháp bất cứ lúc nào và quay lại hoàn thiện sau.</p>
            </div>
            <span className="subtle-badge">Bản nháp</span>
          </div>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const result = validateReport(draft);
              setErrors(result);
              setPreview(Object.keys(result).length === 0);
              setNotice(
                Object.keys(result).length
                  ? "Kiểm tra các trường được đánh dấu bên dưới."
                  : "",
              );
            }}
          >
            <div className="form-row">
              <label>
                Tuần thực tập
                <select
                  value={draft.week}
                  onChange={(event) => update("week", event.target.value)}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Tuần {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Số giờ thực tập *
                <input
                  type="number"
                  min="0.5"
                  max="168"
                  step="0.5"
                  value={draft.hours}
                  placeholder="Ví dụ: 40"
                  onChange={(event) => update("hours", event.target.value)}
                  aria-invalid={!!errors.hours}
                  aria-describedby={errors.hours ? "hours-error" : undefined}
                />
                {errors.hours && (
                  <small id="hours-error" className="field-error">
                    {errors.hours}
                  </small>
                )}
              </label>
            </div>
            {(
              [
                [
                  "work",
                  "Công việc đã thực hiện",
                  "Bạn đã làm gì? Kết quả cụ thể là gì?",
                ],
                [
                  "learning",
                  "Điều đã học và khó khăn",
                  "Kỹ năng mới, phản hồi hoặc điều cần được hỗ trợ…",
                ],
                [
                  "nextPlan",
                  "Kế hoạch tuần tiếp theo",
                  "Những công việc bạn dự định hoàn thành…",
                ],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key}>
                {label} *
                <textarea
                  rows={key === "work" ? 5 : 3}
                  value={draft[key]}
                  maxLength={3000}
                  placeholder={placeholder}
                  onChange={(event) => update(key, event.target.value)}
                  aria-invalid={!!errors[key]}
                  aria-describedby={errors[key] ? `${key}-error` : undefined}
                />
                {errors[key] && (
                  <small id={`${key}-error`} className="field-error">
                    {errors[key]}
                  </small>
                )}
              </label>
            ))}
            <div className="form-footer">
              <span>Chưa gửi cho người hướng dẫn</span>
              <div>
                <button
                  type="button"
                  className="button secondary"
                  onClick={save}
                >
                  Lưu nháp
                </button>
                <button type="submit" className="button primary">
                  Kiểm tra & xem trước <Icon name="arrow" />
                </button>
              </div>
            </div>
          </form>
          {preview && (
            <div className="report-detail" role="status">
              <h3>
                Bản xem trước · Tuần {draft.week} · {draft.hours} giờ
              </h3>
              <h4>Công việc đã thực hiện</h4>
              <p className="preserve-lines">{draft.work}</p>
              <h4>Điều đã học và khó khăn</h4>
              <p className="preserve-lines">{draft.learning}</p>
              <h4>Kế hoạch tiếp theo</h4>
              <p className="preserve-lines">{draft.nextPlan}</p>
              <p className="preview-note">
                Nội dung hợp lệ theo kiểm tra minh họa. Chức năng gửi chính thức
                sẽ có sau khi kết nối backend và đăng nhập.
              </p>
            </div>
          )}
        </section>
      )}
      {view === "internship" && (
        <div className="dashboard-grid">
          <section className="card">
            <div className="section-title">
              <h2>Frontend Developer Intern</h2>
              <span className="status">Đang thực tập</span>
            </div>
            <p>Công ty Cổ phần FPT Software</p>
            <dl className="detail-grid">
              <div>
                <dt>Thời gian</dt>
                <dd>03/08 — 25/10/2026</dd>
              </div>
              <div>
                <dt>Hình thức</dt>
                <dd>Trực tiếp · TP. Hồ Chí Minh</dd>
              </div>
              <div>
                <dt>Ngành học</dt>
                <dd>Công nghệ thông tin</dd>
              </div>
              <div>
                <dt>Thời lượng dự kiến</dt>
                <dd>12 tuần · 480 giờ</dd>
              </div>
            </dl>
            <h3>Mục tiêu học tập</h3>
            <p>
              Phát triển giao diện web, làm việc với API và tham gia quy trình
              phát triển phần mềm trong nhóm.
            </p>
            <div className="info-note">
              Thông tin dùng để trải nghiệm giao diện. Mục tiêu, số giờ và chính
              sách sẽ được cấu hình theo kỳ thực tập thực tế.
            </div>
          </section>
          <section className="card">
            <div className="section-title">
              <h2>Cột mốc thực tập</h2>
            </div>
            <ol className="timeline">
              {[
                "Đủ điều kiện thực tập",
                "Hồ sơ được phê duyệt",
                "Bắt đầu thực tập",
                "Đánh giá giữa kỳ · 18/09",
                "Nộp báo cáo cuối kỳ · 23/10",
                "Tổng kết và công bố kết quả",
              ].map((item, i) => (
                <li key={item} className={i < 3 ? "complete" : ""}>
                  <span>{i < 3 ? <Icon name="check" /> : i + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </WorkspaceShell>
  );
}
function Stat({
  icon,
  value,
  unit,
  label,
  detail,
}: {
  icon: string;
  value: string;
  unit: string;
  label: string;
  detail: string;
}) {
  return (
    <section className="stat card">
      <div className="stat-top">
        <span>{label}</span>
        <Icon name={icon} />
      </div>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{detail}</p>
    </section>
  );
}
function ReportList({
  items,
  onSelect,
}: {
  items: typeof reports;
  onSelect: (week: number) => void;
}) {
  return (
    <div className="report-list">
      {items.map((report) => (
        <button
          className="report-row"
          key={report.week}
          onClick={() => onSelect(report.week)}
        >
          <span className="week-box">
            <small>TUẦN</small>
            <strong>{String(report.week).padStart(2, "0")}</strong>
          </span>
          <span className="report-title">
            <strong>{report.title}</strong>
            <small>
              {report.date} · {report.hours} giờ thực tập
            </small>
          </span>
          <span className="status">
            <Icon name="check" />
            Đã duyệt
          </span>
          <Icon name="arrow" />
        </button>
      ))}
    </div>
  );
}
