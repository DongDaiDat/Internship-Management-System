"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
type Data = {
  total: number;
  threshold: number;
  summary: { total: number; ready: number; blocked: number };
  items: {
    id: string;
    code: string;
    name: string;
    reason: string;
    completed: number;
    capacity: number;
  }[];
};
export function ReadinessReport({ periodId }: { periodId: string }) {
  const [kind, setKind] = useState("eligibility");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    if (periodId)
      void api<Data>(
        `/reports/readiness?${new URLSearchParams({ periodId, kind, filter, search, page: String(page) })}`,
        { signal: controller.signal },
      )
        .then((value) => {
          if (!controller.signal.aborted) setData(value);
        })
        .catch((cause: Error) => {
          if (!controller.signal.aborted) setError(cause.message);
        });
    return () => controller.abort();
  }, [periodId, kind, filter, search, page]);
  return (
    <section
      className="card application-report profile-editor"
      aria-label="Điều kiện và quota"
    >
      <h2>Điều kiện đăng ký và quota</h2>
      <p>
        Chọn một đợt để kiểm tra danh mục chung Trường CNTT theo ngưỡng tín chỉ
        của đợt. Đây là hồ sơ hiện tại, không thay snapshot đã duyệt. Quota tính
        tổng thực tập còn hiệu lực ở mọi đợt; không hiển thị sinh viên ngoài
        phạm vi.
      </p>
      {!periodId ? (
        <p>Hãy chọn một đợt ở bộ lọc báo cáo.</p>
      ) : (
        <>
          <label>
            Nhóm thống kê
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(1);
                setFilter("all");
              }}
            >
              <option value="eligibility">Điều kiện sinh viên</option>
              <option value="quota">Quota giảng viên</option>
            </select>
          </label>
          <div className="pagination">
            <label>
              Tìm hồ sơ điều kiện hoặc quota
              <input
                value={search}
                maxLength={100}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            {["all", "ready", "blocked"].map((key) => (
              <button
                className="button secondary"
                key={key}
                aria-pressed={filter === key}
                onClick={() => {
                  setFilter(key);
                  setPage(1);
                }}
              >
                {key === "all"
                  ? "Tất cả"
                  : key === "ready"
                    ? "Đủ điều kiện / còn quota"
                    : "Chưa đủ / hết quota"}
                {data
                  ? ` (${data.summary[key === "all" ? "total" : (key as "ready" | "blocked")]})`
                  : ""}
              </button>
            ))}
          </div>
          {error && <p role="alert">{error}</p>}
          {!data && !error && <p role="status">Đang kiểm tra…</p>}
          {data && (
            <>
              <p>
                {data.total} hồ sơ · Ngưỡng tín chỉ {data.threshold}% · Chưa xét
                việc đang mở đăng ký hay công ty được chọn.
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Họ tên</th>
                      <th>
                        {kind === "quota"
                          ? "Đang phụ trách / quota"
                          : "Tín chỉ hoàn thành / chương trình"}
                      </th>
                      <th>Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.code}</td>
                        <td>{item.name}</td>
                        <td>
                          {item.completed}/{item.capacity}
                        </td>
                        <td>{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.items.length && <p>Không có hồ sơ phù hợp.</p>}
              <div className="pagination">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Trang trước
                </button>
                <span>Trang {page}</span>
                <button
                  disabled={page * 20 >= data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Trang sau
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
