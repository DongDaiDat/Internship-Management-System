"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ExportReport } from "./report-actions";
const statuses: Record<string, string> = {
  Draft: "Bản nháp",
  Submitted: "Chờ phê duyệt",
  NeedsRevision: "Cần bổ sung",
  Approved: "Đã duyệt",
  Rejected: "Từ chối",
  Cancelled: "Đã hủy",
};
type Result = {
  total: number;
  items: {
    id: string;
    status: string;
    eligibilityPassed: boolean;
    student: { fullName: string; studentCode: string; className: string };
    period: { name: string };
    company: { name: string } | null;
    externalCompanyName: string | null;
  }[];
};
export function ApplicationReport({ periodId }: { periodId: string }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (periodId) query.set("periodId", periodId);
    if (status) query.set("status", status);
    if (search) query.set("search", search);
    api<Result>(`/reports/applications?${query}`, { signal: controller.signal })
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
  }, [periodId, status, search, page]);
  return (
    <section
      className="card profile-editor application-report"
      aria-label="Báo cáo đăng ký"
    >
      <h2>Danh sách đăng ký</h2>
      <ExportReport
        path={`/reports/applications/export?${new URLSearchParams({ ...(periodId ? { periodId } : {}), ...(status ? { status } : {}), ...(search ? { search } : {}) })}`}
        name="dang-ky.xlsx"
      />
      <p>
        Dữ liệu theo đợt đang chọn và quyền truy cập của bạn. Điều kiện hiển thị
        là kết quả kiểm tra lưu trên hồ sơ đăng ký, không phải kiểm tra học vụ
        mới.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(draft.trim());
          setPage(1);
        }}
      >
        <label>
          Tìm theo tên hoặc mã sinh viên
          <input
            type="search"
            maxLength={100}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <label>
          Trạng thái đăng ký
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(statuses).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary">Tìm kiếm</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Đang tải danh sách…</p>
      ) : (
        result && (
          <>
            <p role="status">{result.total} hồ sơ phù hợp</p>
            {result.items.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Sinh viên</th>
                      <th>Đợt thực tập</th>
                      <th>Doanh nghiệp</th>
                      <th>Điều kiện lúc đăng ký</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.student.fullName}
                          <br />
                          {item.student.studentCode} · {item.student.className}
                        </td>
                        <td>{item.period.name}</td>
                        <td>
                          {item.company?.name ||
                            item.externalCompanyName ||
                            "Chưa chọn"}
                        </td>
                        <td>
                          {item.eligibilityPassed
                            ? "Đủ điều kiện"
                            : "Chưa đủ điều kiện"}
                        </td>
                        <td>{statuses[item.status] || "Chưa xác định"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Không có hồ sơ khớp bộ lọc.</p>
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
