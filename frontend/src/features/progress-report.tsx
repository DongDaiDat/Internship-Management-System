"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ExportReport, InternshipAudit } from "./report-actions";
const filters = {
  all: "Tất cả",
  graded: "Đã chốt",
  passed: "Đạt",
  failed: "Không đạt",
  missingFaculty: "Thiếu điểm giảng viên",
  missingCompany: "Thiếu phiếu doanh nghiệp",
};
type Result = {
  total: number;
  summary: Record<keyof typeof filters, number>;
  items: {
    id: string;
    student: { fullName: string; studentCode: string };
    periodName: string;
    mentorName: string;
    companyName: string | null;
    submittedWeeks: number;
    reviewedWeeks: number;
    weeks: number;
    overdueWeeks: number | null;
    missingSchedule: boolean;
    companyVotes: number;
    expectedVotes: number;
    companyScore: number | null;
    facultyScore: number | null;
    finalGrade: { total: number; letterGrade: string; passed: boolean } | null;
  }[];
};
export function ProgressReport({ periodId }: { periodId: string }) {
  const [filter, setFilter] = useState<keyof typeof filters>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      filter,
      page: String(page),
      pageSize: "20",
      search,
    });
    if (periodId) query.set("periodId", periodId);
    api<Result>(`/reports/progress?${query}`, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((cause: Error) => {
        if (!controller.signal.aborted) {
          setError(cause.message);
          setResult(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [periodId, filter, page, retry, search]);
  return (
    <section
      className="card application-report profile-editor"
      aria-label="Tiến độ và kết quả"
    >
      <h2>Tiến độ và kết quả thực tập</h2>
      <ExportReport
        path={`/reports/progress/export?${new URLSearchParams({ filter, search, ...(periodId ? { periodId } : {}) })}`}
        name="tien-do-ket-qua.xlsx"
      />
      <p>
        Chọn chỉ số để xem danh sách tương ứng trong đợt đang lọc. Điểm chưa
        chốt chỉ là thành phần hiện có; kết quả đã chốt giữ nguyên lịch sử.
      </p>
      <div className="pagination">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(draft.trim());
            setPage(1);
          }}
        >
          <label>
            Tìm tiến độ theo tên hoặc mã sinh viên
            <input
              type="search"
              maxLength={100}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <button className="button secondary">Tìm kiếm</button>
        </form>
        {Object.entries(filters).map(([key, label]) => (
          <button
            key={key}
            className="button secondary"
            aria-pressed={filter === key}
            onClick={() => {
              setFilter(key as keyof typeof filters);
              setPage(1);
            }}
          >
            {label}
            {result ? ` (${result.summary[key as keyof typeof filters]})` : ""}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert">
          {error} <button onClick={() => setRetry(retry + 1)}>Thử lại</button>
        </p>
      )}
      {loading ? (
        <p role="status">Đang tải tiến độ…</p>
      ) : (
        result && (
          <>
            <p role="status">{result.total} kỳ thực tập phù hợp</p>
            {result.items.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Sinh viên</th>
                      <th>Đợt / nơi thực tập</th>
                      <th>Báo cáo tuần</th>
                      <th>Điểm thành phần</th>
                      <th>Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.student.fullName}
                          <br />
                          {item.student.studentCode}
                        </td>
                        <td>
                          {item.periodName}
                          <br />
                          {item.companyName || "Chưa có công ty"}
                          <br />
                          GVHD: {item.mentorName}
                        </td>
                        <td>
                          Nộp {item.submittedWeeks}/{item.weeks}
                          <br />
                          Đã nhận xét: {item.reviewedWeeks}
                          <br />
                          {item.missingSchedule
                            ? "Thiếu lịch — chưa tính trễ hạn"
                            : `Quá hạn chưa nộp: ${item.overdueWeeks}`}
                        </td>
                        <td>
                          Doanh nghiệp:{" "}
                          {item.companyScore?.toFixed(2) ?? "Chưa đủ phiếu"}
                          <br />
                          Phiếu: {item.companyVotes}/{item.expectedVotes}
                          <br />
                          Giảng viên: {item.facultyScore ?? "Chưa chấm"}
                        </td>
                        <td>
                          {item.finalGrade
                            ? `${item.finalGrade.total}/10 · ${item.finalGrade.letterGrade} · ${item.finalGrade.passed ? "Đạt" : "Không đạt"}`
                            : "Chưa chốt"}
                          <InternshipAudit id={item.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Không có kỳ thực tập khớp bộ lọc.</p>
            )}
            <div className="pagination">
              <button
                className="button secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Trang trước
              </button>
              <span>
                Trang {page}/{Math.max(1, Math.ceil(result.total / 20))}
              </span>
              <button
                className="button secondary"
                disabled={page * 20 >= result.total}
                onClick={() => setPage(page + 1)}
              >
                Trang sau
              </button>
            </div>
          </>
        )
      )}
    </section>
  );
}
