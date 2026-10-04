"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { FilePanel } from "./file-panel";

type Internship = {
  id: string;
  student: { fullName: string; studentCode: string; className: string };
  company: { name: string };
  period: { name: string; weeklyReportCount: number };
  weeklyReports: {
    id: string;
    weekNumber: number;
    content: string;
    status: string;
    mentorNote: string | null;
  }[];
  finalReport: { content: string } | null;
  facultyEvaluation: { score: number; note: string | null } | null;
  finalGrade: { total: number; letterGrade: string } | null;
};

export function MentorPortal() {
  const [items, setItems] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [dirty, setDirty] = useState(false);
  const load = useCallback(async () => {
    const result = await api<{ internships: Internship[] }>(
      "/internships/mine",
    );
    setItems(result.internships);
  }, []);
  useEffect(() => {
    void load()
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [load]);
  async function save(path: string, body: object) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      setNotice("Đã lưu đánh giá.");
      setDirty(false);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể lưu đánh giá.",
      );
    } finally {
      setBusy(false);
    }
  }
  const filtered = items.filter((item) =>
    `${item.student.fullName} ${item.student.studentCode} ${item.period.name}`
      .toLocaleLowerCase("vi")
      .includes(search.trim().toLocaleLowerCase("vi")),
  );
  return (
    <section className="student-portal" aria-label="Sinh viên được hướng dẫn">
      <section className="card editor">
        <h2>Sinh viên tôi hướng dẫn</h2>
        <p>
          {items.length} kỳ thực tập ·{" "}
          {items.reduce(
            (count, item) =>
              count +
              item.weeklyReports.filter((r) => r.status === "Submitted").length,
            0,
          )}{" "}
          báo cáo chờ nhận xét
        </p>
        <label>
          Chọn sinh viên để nhận xét và đánh giá
          <input
            type="search"
            disabled={busy}
            value={search}
            onChange={(e) => {
              if (
                dirty &&
                !window.confirm("Nội dung chưa lưu. Bạn muốn đổi bộ lọc?")
              )
                return;
              setDirty(false);
              setSearch(e.target.value);
            }}
            placeholder="Tên sinh viên, mã sinh viên, tên đợt…"
          />
        </label>
        <label>
          Hồ sơ đang xem · {filtered.length} kết quả
          <select
            value={
              filtered.some((i) => i.id === selectedId)
                ? selectedId
                : filtered[0]?.id || ""
            }
            onChange={(e) => {
              if (
                dirty &&
                !window.confirm("Nội dung chưa lưu. Bạn muốn chuyển sinh viên?")
              )
                return;
              setDirty(false);
              setSelectedId(e.target.value);
              setNotice("");
            }}
            disabled={busy || !filtered.length}
          >
            {!filtered.length && (
              <option value="">Không có hồ sơ phù hợp</option>
            )}
            {filtered.map((item) => (
              <option key={item.id} value={item.id}>
                {item.student.fullName} · {item.student.studentCode} ·{" "}
                {item.period.name}
              </option>
            ))}
          </select>
        </label>
      </section>
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
      {loading ? (
        <p className="empty-state">Đang tải danh sách…</p>
      ) : (
        !filtered.length && (
          <p className="card empty-state">
            {items.length
              ? "Không tìm thấy sinh viên phù hợp."
              : "Bạn chưa được phân công sinh viên."}
          </p>
        )
      )}
      {filtered
        .filter(
          (item) =>
            item.id ===
            (filtered.find((i) => i.id === selectedId)?.id || filtered[0]?.id),
        )
        .map((item) => (
          <section
            className="card editor assignment-detail"
            key={item.id}
            onInput={() => setDirty(true)}
          >
            <p className="eyebrow">{item.period.name}</p>
            <h2>{item.student.fullName}</h2>
            <p>
              {item.student.studentCode} · {item.student.className} ·{" "}
              {item.company.name}
            </p>
            <FilePanel internshipId={item.id} />
            <p>
              Đã nộp {item.weeklyReports.length}/{item.period.weeklyReportCount}{" "}
              báo cáo tuần
            </p>
            <progress
              aria-label={`Tiến độ báo cáo của ${item.student.fullName}`}
              value={item.weeklyReports.length}
              max={item.period.weeklyReportCount}
            />
            {item.weeklyReports.map((report) => (
              <details className="portal-entry" key={report.id}>
                <summary>
                  Tuần {report.weekNumber} ·{" "}
                  {report.status === "Reviewed"
                    ? "Đã nhận xét"
                    : report.status === "NeedsRevision"
                      ? "Đã yêu cầu bổ sung"
                      : "Chờ nhận xét"}
                </summary>
                <p className="report-content">{report.content}</p>
                {report.mentorNote && (
                  <p className="notice">Nhận xét đã lưu: {report.mentorNote}</p>
                )}
                {!item.finalGrade && report.status !== "Reviewed" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(
                        `/weekly-reports/${report.id}/review`,
                        Object.fromEntries(new FormData(e.currentTarget)),
                      );
                    }}
                  >
                    <label>
                      Nhận xét
                      <textarea
                        name="note"
                        defaultValue={report.mentorNote || ""}
                        minLength={2}
                        maxLength={2000}
                        required
                        rows={3}
                      />
                    </label>
                    <label>
                      Kết quả
                      <select name="status" defaultValue="Reviewed">
                        <option value="Reviewed">
                          Đã nhận xét — khóa nội dung
                        </option>
                        <option value="NeedsRevision">
                          Yêu cầu sinh viên bổ sung
                        </option>
                      </select>
                    </label>
                    <button className="button primary" disabled={busy}>
                      Lưu nhận xét
                    </button>
                  </form>
                )}
              </details>
            ))}
            <details className="portal-entry">
              <summary>
                Báo cáo cuối kỳ · {item.finalReport ? "Đã nộp" : "Chưa nộp"}
              </summary>
              <p className="report-content">
                {item.finalReport?.content ||
                  "Sinh viên chưa nộp báo cáo cuối kỳ."}
              </p>
            </details>
            {item.finalGrade ? (
              <p className="notice">
                Đã chốt: {item.finalGrade.total}/10 ·{" "}
                {item.finalGrade.letterGrade}. Các đánh giá đã khóa.
              </p>
            ) : (
              <details className="portal-entry">
                <summary>
                  Điểm giảng viên ·{" "}
                  {item.facultyEvaluation
                    ? `${item.facultyEvaluation.score}/10`
                    : "Chưa chấm"}
                </summary>
                <p>
                  Điểm tổng hợp gồm quá trình thực tập và báo cáo cuối; chiếm
                  50% điểm tổng kết.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    void save(`/internships/${item.id}/faculty-score`, {
                      score: Number(form.get("score")),
                      note: form.get("note"),
                    });
                  }}
                >
                  <label>
                    Điểm (0–10)
                    <input
                      name="score"
                      type="number"
                      min={0}
                      max={10}
                      step="0.01"
                      required
                      defaultValue={item.facultyEvaluation?.score}
                    />
                  </label>
                  <label>
                    Nhận xét tổng kết
                    <textarea
                      name="note"
                      maxLength={1000}
                      rows={3}
                      defaultValue={item.facultyEvaluation?.note || ""}
                    />
                  </label>
                  <button className="button primary" disabled={busy}>
                    Lưu điểm giảng viên
                  </button>
                </form>
              </details>
            )}
          </section>
        ))}
    </section>
  );
}
