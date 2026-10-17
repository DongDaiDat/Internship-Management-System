"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useSearchParams } from "next/navigation";
import { MentorRequest, responseLabels } from "./mentor-request-ui";
type Item = MentorRequest & {
  application: {
    status: string;
    positionTitle: string;
    externalCompanyName: string | null;
    company: { name: string } | null;
    period: { name: string; status: string; endsAt: string };
    student: {
      fullName: string;
      studentCode: string;
      className: string;
      completedCredits: number;
      programCredits: number;
      academicMajor: { name: string } | null;
      program: { name: string } | null;
      academicCohort: { code: string } | null;
    };
  };
};
type Data = {
  items: Item[];
  total: number;
  pendingCount: number;
  assignedCount: number;
  maxStudents: number;
  periods: { id: string; name: string }[];
};
export function MentorRequestsPage() {
  const params = useSearchParams(),
    requestId = params.get("requestId") || "";
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState("Pending");
  const [period, setPeriod] = useState(params.get("periodId") || "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const result = await api<Data>(
        `/mentor-requests?${new URLSearchParams({ page: String(page), ...(status ? { status } : {}), ...(period ? { periodId: period } : {}), ...(search ? { search } : {}), ...(requestId ? { requestId } : {}) })}`,
        { signal },
      );
      if (!signal?.aborted) setData(result);
    },
    [page, status, period, search, requestId],
  );
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    void load(c.signal).catch((e: Error) => {
      if (!c.signal.aborted) setError(e.message);
    });
    return () => c.abort();
  }, [load]);
  return (
    <section className="student-portal" aria-label="Đề xuất hướng dẫn">
      <section className="card">
        <h2>Đề xuất hướng dẫn</h2>
        <p className="info-note">
          Đồng ý hướng dẫn chưa phải là phân công chính thức và không giữ chỉ
          tiêu.
        </p>
        {error && (
          <p className="login-error" role="alert">
            {error}{" "}
            <button
              className="text-button"
              onClick={() =>
                void load()
                  .then(() => setError(""))
                  .catch((e: Error) => setError(e.message))
              }
            >
              Tải lại
            </button>
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <fieldset disabled={busy}>
          <div className="mentor-request-filters">
            <label>
              Tìm sinh viên
              <input
                value={search}
                maxLength={120}
                placeholder="Tên hoặc mã sinh viên"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              Đợt thực tập
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả đợt</option>
                {data?.periods.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả</option>
                <option value="Pending">Chờ phản hồi</option>
                <option value="Accepted">Đã đồng ý</option>
                <option value="Declined">Đã từ chối</option>
                <option value="Closed">Đã kết thúc</option>
              </select>
            </label>
          </div>
        </fieldset>
        {!data && !error && <p role="status">Đang tải đề xuất…</p>}
        {data && (
          <>
            <p>
              <strong>{data.pendingCount}</strong> yêu cầu cần phản hồi · Đang
              hướng dẫn{" "}
              <strong>
                {data.assignedCount}/{data.maxStudents}
              </strong>
            </p>
            {!data.items.length && (
              <p className="empty-state">
                Không có đề xuất phù hợp với bộ lọc.
              </p>
            )}
            {data.items.map((r) => {
              const a = r.application;
              const canRespond =
                !r.closedAt &&
                r.response === "Pending" &&
                a.status === "Submitted" &&
                a.period.status === "Published" &&
                Date.now() < Date.parse(a.period.endsAt);
              return (
                <article className="portal-entry" key={r.id}>
                  <h3>
                    {a.student.fullName} · {a.student.studentCode}
                  </h3>
                  <p>
                    {a.period.name} · {a.student.academicMajor?.name} ·{" "}
                    {a.student.academicCohort?.code}
                  </p>
                  <p>
                    {a.student.program?.name} · Lớp {a.student.className} ·{" "}
                    {a.student.completedCredits}/{a.student.programCredits} tín
                    chỉ
                  </p>
                  <p>
                    {a.company?.name ?? a.externalCompanyName} ·{" "}
                    {a.positionTitle}
                  </p>
                  <p>
                    <strong>Lý do:</strong> {r.reason}
                  </p>
                  <span className="subtle-badge">
                    {responseLabels[r.response]}
                    {r.closedAt ? " · Đã kết thúc" : ""}
                  </span>
                  {r.responseNote && <p>Phản hồi: {r.responseNote}</p>}
                  {canRespond && (
                    <ResponseForm
                      busy={busy}
                      onSubmit={async (response, note) => {
                        setBusy(true);
                        setError("");
                        setNotice("");
                        try {
                          await api(`/mentor-requests/${r.id}/respond`, {
                            method: "POST",
                            body: JSON.stringify({ response, note }),
                          });
                          setNotice(
                            "Đã gửi phản hồi. Khoa sẽ quyết định phân công chính thức.",
                          );
                          await load();
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Không thể gửi phản hồi.",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  )}
                </article>
              );
            })}
            <div className="pagination">
              <button
                className="button secondary"
                disabled={busy || page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Trang trước
              </button>
              <span>
                Trang {page} / {Math.max(1, Math.ceil(data.total / 20))}
              </span>
              <button
                className="button secondary"
                disabled={busy || page * 20 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau
              </button>
            </div>
          </>
        )}
      </section>
    </section>
  );
}
function ResponseForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (response: string, note: string) => Promise<void>;
}) {
  const [response, setResponse] = useState("Accepted");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void onSubmit(response, String(f.get("note") ?? "").trim());
      }}
    >
      <fieldset disabled={busy}>
        <label>
          Phản hồi đề xuất
          <select
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          >
            <option value="Accepted">Đồng ý hướng dẫn</option>
            <option value="Declined">Từ chối hướng dẫn</option>
          </select>
        </label>
        <label>
          {response === "Declined" ? "Lý do từ chối" : "Ghi chú"}
          <textarea
            name="note"
            required={response === "Declined"}
            minLength={response === "Declined" ? 10 : undefined}
            maxLength={500}
          />
        </label>
        <button className="button primary">
          {busy ? "Đang gửi…" : "Gửi phản hồi"}
        </button>
      </fieldset>
    </form>
  );
}
