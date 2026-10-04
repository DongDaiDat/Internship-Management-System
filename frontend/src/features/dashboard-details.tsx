"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function DashboardDetails({
  metric,
  periodId,
}: {
  metric: string;
  periodId: string;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    total: number;
    items: { id: string; title: string; detail: string }[];
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    const query = new URLSearchParams({ metric, page: String(page) });
    if (periodId) query.set("periodId", periodId);
    void api<NonNullable<typeof data>>(`/reports/dashboard?${query}`, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((cause: Error) => {
        if (!controller.signal.aborted) setError(cause.message);
      });
    return () => controller.abort();
  }, [metric, periodId, page]);
  return (
    <section className="card application-report" aria-label="Chi tiết chỉ số">
      <h2>Chi tiết chỉ số</h2>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Đang tải danh sách…</p>}
      {data && (
        <>
          <p>{data.total} mục phù hợp</p>
          <ul>
            {data.items.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </li>
            ))}
          </ul>
          {!data.items.length && <p>Không có dữ liệu phù hợp.</p>}
          <div className="pagination">
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Trang trước
            </button>
            <span>Trang {page}</span>
            <button
              className="button secondary"
              disabled={page * 20 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Trang sau
            </button>
          </div>
        </>
      )}
    </section>
  );
}
