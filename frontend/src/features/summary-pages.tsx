"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, Role } from "../lib/api";
import { ExportReport } from "./report-actions";

type Option = { id: string; name: string };
type Entry = {
  completed?: boolean;
  companyName?: string | null;
  id: string;
  kind: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  source: string;
  reason?: string;
  snapshot?: {
    facultyEvaluation?: { score: number; note?: string };
    finalReport?: { score: number | null; mentorNote?: string };
    weeklyReviews?: { weekNumber: number; mentorNote?: string }[];
    evaluations?: { score: number; note?: string }[];
  };
};
type Row = {
  id: string;
  student: { fullName: string; studentCode: string };
  period: Option;
  academicYear: string | null;
  semester: number | null;
  company: Option | null;
  mentor: Option | null;
  department: Option | null;
  cohort: Option | null;
  status: string;
  isCurrent: boolean;
  submittedReports: number | null;
  expectedReports: number | null;
  missingReports: number | null;
  pendingReviews: number | null;
  facultyScore: number | null;
  companyScores: { score: number; note?: string }[];
  finalGrade: { total: number; letterGrade: string } | null;
  assignments: Entry[];
};
type Data = {
  studentCount: number;
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  options: Record<string, Option[]>;
  companies: (Option & { total: number; active: number })[];
  mentors: (Option & { total: number; active: number })[];
};
const statuses: Record<string, string> = {
  upcoming: "Sắp diễn ra",
  active: "Đang thực tập",
  awaiting: "Chờ hoàn tất",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
};
const kinds: Record<string, string> = {
  mentor: "Giảng viên",
  company: "Doanh nghiệp",
  supervisor: "Hướng dẫn doanh nghiệp",
};
const date = (v: string) => new Date(v).toLocaleDateString("vi-VN");

export function SummaryOverview({ role }: { role: Role }) {
  const pathname = usePathname();
  const root = pathname.split("/").slice(0, 3).join("/");
  const [data, setData] = useState<{
    metrics: {
      key: string;
      label: string;
      value: number;
      query?: string;
      path?: string;
    }[];
    tasks: { label: string; count: number; path: string }[];
    recent?: { id: string; action: string; createdAt: string }[];
  } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    api<NonNullable<typeof data>>("/reports/overview", { signal: c.signal })
      .then(setData)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [role, attempt]);
  return (
    <>
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">QUẢN LÝ THỰC TẬP PHENIKAA</span>
          <h2>
            {role === "Admin"
              ? "Sẵn sàng cho một kỳ thực tập hiệu quả"
              : role === "FacultyManager"
                ? "Tổng quan thực tập của khoa"
                : role === "FacultyMentor"
                  ? "Đồng hành cùng sinh viên"
                  : role === "InternshipCoordinator"
                    ? "Theo dõi các đợt phụ trách"
                    : "Tổng quan hoạt động thực tập"}
          </h2>
          <p>Chọn một chỉ số để xem danh sách và xử lý công việc liên quan.</p>
        </div>
      </div>
      {error ? (
        <p role="alert" className="login-error">
          {error}{" "}
          <button
            onClick={() => {
              setError("");
              setAttempt((v) => v + 1);
            }}
          >
            Thử lại
          </button>
        </p>
      ) : !data ? (
        <p role="status">Đang tải tổng quan…</p>
      ) : (
        <>
          <div className="overview-metrics summary-metrics">
            {data.metrics.map((m) => (
              <Link
                className="card"
                key={m.key}
                href={
                  m.path ||
                  `${root}/summary?${m.query || ""}${m.query?.includes("assignment=") ? "" : "&assignment=all"}`
                }
              >
                <span>{m.label}</span>
                <strong>{m.value}</strong>
                <small>Xem chi tiết →</small>
              </Link>
            ))}
          </div>
          {data.recent && (
            <section className="card">
              <h2>Hoạt động tài khoản gần đây</h2>
              {data.recent.length ? (
                data.recent.map((r) => (
                  <p key={r.id}>
                    {date(r.createdAt)} ·{" "}
                    {r.action.includes("reset")
                      ? "Đặt lại mật khẩu"
                      : "Cấp tài khoản"}
                  </p>
                ))
              ) : (
                <p>Chưa có hoạt động cấp hoặc đặt lại mật khẩu.</p>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}

function History({ id }: { id: string }) {
  const [items, setItems] = useState<Entry[] | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await api<Entry[]>(`/reports/internships/${id}/history`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được lịch sử.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <details
      className="summary-history"
      open
      onToggle={(e) => {
        if (e.currentTarget.open && !items && !loading && !error) void load();
      }}
    >
      <summary>Lịch sử & đánh giá</summary>
      {loading && <p role="status">Đang tải…</p>}
      {error && (
        <p role="alert">
          {error} <button onClick={() => void load()}>Thử lại</button>
        </p>
      )}
      {items?.length === 0 && <p>Chưa có mốc lịch sử được ghi nhận.</p>}
      {items?.map((h) => (
        <article key={h.id}>
          <strong>
            {kinds[h.kind]} · {h.name}
          </strong>
          {h.companyName && h.kind !== "company" && (
            <p>Doanh nghiệp: {h.companyName}</p>
          )}
          <p>
            {date(h.startedAt)} –{" "}
            {h.endedAt
              ? date(h.endedAt)
              : h.completed
                ? "Đã hoàn thành"
                : "Hiện tại"}
            {h.source === "Migration" ? " · Ghi nhận từ dữ liệu hiện tại" : ""}
          </p>
          {h.reason && <p>Lý do: {h.reason}</p>}
          {h.snapshot?.facultyEvaluation && (
            <p>
              Điểm hướng dẫn: {h.snapshot.facultyEvaluation.score} ·{" "}
              {h.snapshot.facultyEvaluation.note}
            </p>
          )}
          {h.snapshot?.finalReport?.score != null && (
            <p>
              Điểm báo cáo cuối: {h.snapshot.finalReport.score} ·{" "}
              {h.snapshot.finalReport.mentorNote}
            </p>
          )}
          {h.snapshot?.weeklyReviews?.map((r) => (
            <p key={r.weekNumber}>
              Tuần {r.weekNumber}: {r.mentorNote || "Đã nhận xét"}
            </p>
          ))}
          {h.snapshot?.evaluations?.map((e, n) => (
            <p key={n}>
              Điểm doanh nghiệp: {e.score} ·{" "}
              {e.note || "Không có nhận xét bổ sung"}
            </p>
          ))}
        </article>
      ))}
    </details>
  );
}

export function SummaryList({
  role,
  history = false,
}: {
  role: Role;
  history?: boolean;
}) {
  const params = useSearchParams(),
    router = useRouter(),
    pathname = usePathname();
  const effectiveParams = new URLSearchParams(params.toString());
  if (
    !history &&
    !["Student", "FacultyManager", "InternshipCoordinator"].includes(role) &&
    !effectiveParams.has("assignment")
  )
    effectiveParams.set("assignment", "current");
  const query = effectiveParams.toString();
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  const [search, setSearch] = useState(params.get("search") || "");
  useEffect(() => setSearch(params.get("search") || ""), [params]);
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const staff = role === "FacultyManager" || role === "InternshipCoordinator";
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    api<Data>(`/reports/internships?${query}`, { signal: c.signal })
      .then(setData)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [query, role, retry]);
  function change(key: string, value: string) {
    setSelectedHistory(null);
    const q = new URLSearchParams(query);
    if (value) q.set(key, value);
    else q.delete(key);
    if (key !== "page") q.delete("page");
    router.push(`${pathname}?${q}`);
  }
  const select = (key: string, label: string, options: Option[]) => (
    <label key={key}>
      {label}
      <select
        aria-label={label}
        value={effectiveParams.get(key) || ""}
        onChange={(e) => change(key, e.target.value)}
      >
        <option value={key === "assignment" ? "all" : ""}>Tất cả</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
  const root = pathname.split("/").slice(0, 3).join("/");
  const operation = staff
    ? role === "FacultyManager"
      ? "grades"
      : "progress"
    : role === "Student"
      ? "results"
      : "students";
  return (
    <>
      {role === "Student" && history && (
        <StudentRegistrations
          key={params.toString()}
          query={params.toString()}
        />
      )}
      <section className="card summary-controls">
        <div className="summary-heading">
          <div>
            <h2>
              {history
                ? "Lịch sử tham gia thực tập"
                : staff
                  ? "Danh sách thực tập"
                  : "Sinh viên và phân công"}
            </h2>
            <p className="muted">
              {history
                ? "Tra cứu theo năm học và đợt. Lịch sử phân công cũ được ghi nhận từ thời điểm hệ thống bắt đầu lưu lịch sử."
                : "Lọc danh sách để xem công ty, người hướng dẫn và tình trạng từng hồ sơ."}
            </p>
          </div>
          {staff && (
            <ExportReport
              path={`/reports/internships/export?${query}`}
              name="tong-hop-thuc-tap.xlsx"
            />
          )}
        </div>
        <form
          className="summary-search"
          onSubmit={(e) => {
            e.preventDefault();
            change("search", search.trim());
          }}
        >
          <label htmlFor="summary-search">Tìm sinh viên</label>
          <input
            id="summary-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Họ tên, mã sinh viên hoặc email"
            maxLength={100}
          />
          <button className="button primary" type="submit">
            Tìm kiếm
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setSearch("");
              router.push(pathname);
            }}
          >
            Xóa bộ lọc
          </button>
        </form>
        <div className="summary-filters">
          {select("academicYear", "Năm học", data?.options.academicYear || [])}
          {select(
            "semester",
            "Học kỳ",
            [1, 2, 3].map((n) => ({ id: String(n), name: `Học kỳ ${n}` })),
          )}
          {select("periodId", "Đợt thực tập", data?.options.periodId || [])}
          {select(
            "status",
            "Trạng thái",
            Object.entries(statuses).map(([id, name]) => ({ id, name })),
          )}
          {select("companyId", "Doanh nghiệp", data?.options.companyId || [])}
          {!staff &&
            role !== "Student" &&
            select("assignment", "Phân công", [
              { id: "current", name: "Hiện tại" },
              { id: "former", name: "Đã kết thúc phân công" },
            ])}
        </div>
        <details className="summary-extra">
          <summary>Bộ lọc bổ sung</summary>
          <div className="summary-filters">
            {[
              ["departmentId", "Khoa"],
              ["majorId", "Ngành"],
              ["programId", "Chương trình"],
              ["cohortId", "Khóa"],
              ["mentorId", "Giảng viên"],
              ["supervisorId", "Hướng dẫn doanh nghiệp"],
            ].map(([key, label]) =>
              select(key, label, data?.options[key] || []),
            )}
            {select("attention", "Tình trạng xử lý", [
              ...(staff || role === "FacultyMentor" || role === "Student"
                ? [
                    { id: "missingReports", name: "Thiếu báo cáo quá hạn" },
                    { id: "pendingReviews", name: "Báo cáo chờ nhận xét" },
                  ]
                : []),
              ...(staff || role === "FacultyMentor"
                ? [{ id: "missingFaculty", name: "Thiếu điểm giảng viên" }]
                : []),
              ...(staff || role === "Company" || role === "CompanySupervisor"
                ? [
                    {
                      id: "missingCompany",
                      name: "Thiếu đánh giá doanh nghiệp",
                    },
                  ]
                : []),
              ...(staff || role === "Company"
                ? [
                    {
                      id: "unassignedSupervisor",
                      name: "Chưa có hướng dẫn doanh nghiệp",
                    },
                  ]
                : []),
              ...(staff || role === "Student"
                ? [
                    { id: "passed", name: "Đạt" },
                    { id: "failed", name: "Chưa đạt" },
                  ]
                : []),
            ])}
            {select("sort", "Sắp xếp", [
              { id: "newest", name: "Mới nhất" },
              { id: "oldest", name: "Cũ nhất" },
              { id: "student", name: "Tên sinh viên" },
            ])}
          </div>
        </details>
      </section>
      {error && (
        <p role="alert" className="login-error">
          {error}{" "}
          <button onClick={() => setRetry((v) => v + 1)}>Thử lại</button>
        </p>
      )}
      {loading && <p role="status">Đang tải danh sách…</p>}
      {!loading && !error && data && (
        <>
          <section className="card">
            <div className="summary-heading">
              <h2>
                {data.studentCount} sinh viên · {data.total} hồ sơ phù hợp
              </h2>
              <label>
                Số dòng{" "}
                <select
                  value={params.get("pageSize") || "20"}
                  onChange={(e) => change("pageSize", e.target.value)}
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            {data.items.length === 0 ? (
              <p className="summary-empty">
                Không có hồ sơ phù hợp. Hãy thử đổi năm học, đợt hoặc xóa bộ
                lọc.
              </p>
            ) : (
              <div className="summary-table-scroll">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th>Sinh viên</th>
                      <th>Đợt / Năm học</th>
                      <th>Công ty / Giảng viên</th>
                      <th>Trạng thái</th>
                      <th>Tiến độ / Kết quả</th>
                      <th>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.student.fullName}</strong>
                          <small>{r.student.studentCode}</small>
                          <small>
                            {r.department?.name} · {r.cohort?.name}
                          </small>
                        </td>
                        <td>
                          {r.period.name}
                          <small>
                            {r.academicYear || "Chưa cập nhật"}
                            {r.semester ? ` · HK${r.semester}` : ""}
                          </small>
                        </td>
                        <td>
                          {r.company?.name || "Chưa có thông tin"}
                          <small>{r.mentor?.name || "—"}</small>
                        </td>
                        <td>
                          <span
                            className={`summary-status summary-status-${r.status}`}
                          >
                            {statuses[r.status]}
                          </span>
                          <small>
                            {r.isCurrent
                              ? "Phân công hiện tại"
                              : "Phân công đã kết thúc"}
                          </small>
                        </td>
                        <td>
                          {r.submittedReports !== null && (
                            <span>
                              Báo cáo: {r.submittedReports}/{r.expectedReports}
                            </span>
                          )}
                          {!!r.missingReports && (
                            <small className="summary-warning">
                              Thiếu {r.missingReports} báo cáo quá hạn
                            </small>
                          )}
                          {r.facultyScore !== null && (
                            <small>Điểm GV: {r.facultyScore}</small>
                          )}
                          {r.companyScores.map((e, n) => (
                            <small key={n}>Điểm DN: {e.score}</small>
                          ))}
                          {r.finalGrade && (
                            <strong>
                              {r.finalGrade.total} · {r.finalGrade.letterGrade}
                            </strong>
                          )}
                          {r.submittedReports === null &&
                            r.companyScores.length === 0 && (
                              <span>Xem đánh giá trong lịch sử</span>
                            )}
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() =>
                              setSelectedHistory(
                                selectedHistory === r.id ? null : r.id,
                              )
                            }
                          >
                            Lịch sử & đánh giá
                          </button>
                          {r.isCurrent && (
                            <Link
                              href={`${root}/${operation}?internshipId=${r.id}&periodId=${r.period.id}`}
                            >
                              Mở trang xử lý →
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <nav className="summary-pagination" aria-label="Phân trang">
              <button
                className="button secondary"
                disabled={data.page <= 1}
                onClick={() => change("page", String(data.page - 1))}
              >
                Trước
              </button>
              <span>
                Trang {data.page} /{" "}
                {Math.max(1, Math.ceil(data.total / data.pageSize))}
              </span>
              <button
                className="button secondary"
                disabled={data.page * data.pageSize >= data.total}
                onClick={() => change("page", String(data.page + 1))}
              >
                Sau
              </button>
            </nav>
            {selectedHistory &&
              data.items.some((r) => r.id === selectedHistory) && (
                <div className="summary-detail">
                  <h3>
                    {
                      data.items.find((r) => r.id === selectedHistory)?.student
                        .fullName
                    }
                  </h3>
                  <History key={selectedHistory} id={selectedHistory} />
                </div>
              )}
          </section>
          {staff && (
            <div className="summary-breakdowns">
              {(
                [
                  ["Theo doanh nghiệp", data.companies, "companyId"],
                  ["Theo giảng viên", data.mentors, "mentorId"],
                ] as const
              ).map(([title, groups, key]) => (
                <section className="card" key={key}>
                  <h2>{title}</h2>
                  <p className="muted">Số liệu theo bộ lọc đang chọn.</p>
                  <div className="summary-table-scroll">
                    <table className="summary-table">
                      <thead>
                        <tr>
                          <th>Đơn vị / Người hướng dẫn</th>
                          <th>Tổng hồ sơ</th>
                          <th>Đang thực tập</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((g) => (
                          <tr key={g.id}>
                            <td>
                              <button
                                className="text-button"
                                onClick={() => change(key, g.id)}
                              >
                                {g.name}
                              </button>
                            </td>
                            <td>{g.total}</td>
                            <td>{g.active}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {groups.length === 0 && <p>Chưa có dữ liệu.</p>}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function StudentRegistrations({ query }: { query: string }) {
  const [page, setPage] = useState(1),
    [data, setData] = useState<{
      items: {
        id: string;
        status: string;
        positionTitle: string;
        createdAt: string;
        reviewNote: string | null;
        period: { name: string };
        company: { name: string } | null;
        externalCompanyName: string | null;
      }[];
      total: number;
    } | null>(null),
    [error, setError] = useState("");
  const labels: Record<string, string> = {
    Draft: "Bản nháp",
    Submitted: "Chờ duyệt",
    NeedsRevision: "Cần bổ sung",
    Approved: "Đã duyệt",
    Rejected: "Đã từ chối",
    Cancelled: "Đã hủy",
  };
  useEffect(() => {
    const c = new AbortController();
    const q = new URLSearchParams(query);
    q.set("page", String(page));
    q.set("pageSize", "10");
    setError("");
    setData(null);
    api<NonNullable<typeof data>>(`/reports/registrations?${q}`, {
      signal: c.signal,
    })
      .then(setData)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [query, page]);
  return (
    <section className="card summary-controls">
      <h2>Các lần đăng ký thực tập</h2>
      <p className="muted">
        Bao gồm hồ sơ đang chờ, bị từ chối và đã hủy; lọc theo năm học, học kỳ
        và đợt bên dưới.
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Đang tải đăng ký…</p>
      ) : (
        <>
          <div className="summary-table-scroll">
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Ngày đăng ký</th>
                  <th>Đợt</th>
                  <th>Doanh nghiệp / Vị trí</th>
                  <th>Trạng thái duyệt</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td>{date(r.createdAt)}</td>
                    <td>{r.period.name}</td>
                    <td>
                      {r.company?.name ||
                        r.externalCompanyName ||
                        "Chưa có công ty"}
                      <small>{r.positionTitle}</small>
                    </td>
                    <td>
                      {labels[r.status] || r.status}
                      <small>{r.reviewNote}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.total && <p>Chưa có hồ sơ đăng ký.</p>}
          <nav className="summary-pagination" aria-label="Phân trang đăng ký">
            <button
              className="button secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Trước
            </button>
            <span>
              {data.total} hồ sơ · Trang {page}
            </span>
            <button
              className="button secondary"
              disabled={page * 10 >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
