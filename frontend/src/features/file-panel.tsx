"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
type FileItem = {
  id: string;
  originalName: string;
  kind: string;
  weekNumber: number | null;
  size: number;
};
export function FilePanel({
  internshipId,
  targets = [],
  supervisors = [],
  onSaved,
  initiallyOpen = false,
}: {
  internshipId: string;
  targets?: { label: string; path: string }[];
  supervisors?: { id: string; name: string }[];
  onSaved?: () => void;
  initiallyOpen?: boolean;
}) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(initiallyOpen);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    setFiles(await api<FileItem[]>(`/internships/${internshipId}/files`));
    setLoaded(true);
  }, [internshipId]);
  useEffect(() => {
    if (opened) void load().catch((cause: Error) => setError(cause.message));
  }, [load, opened]);
  async function save(form: HTMLFormElement, proxy: boolean) {
    const body = new FormData(form);
    const file = body.get("file");
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) {
      setError("Chọn PDF tối đa 10 MB.");
      return;
    }
    const path = proxy
      ? `/internships/${internshipId}/company-scores/${body.get("supervisorId")}/evidence`
      : String(body.get("target"));
    body.delete("target");
    body.delete("supervisorId");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(path, { method: "POST", body });
      await load();
      setNotice(
        proxy ? "Đã lưu phiếu chấm thay có minh chứng." : "Đã lưu tệp báo cáo.",
      );
      form.reset();
      onSaved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải tệp.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      open={opened}
      className="profile-editor"
      onToggle={(e) => setOpened(e.currentTarget.open)}
    >
      <summary>
        Tệp báo cáo và minh chứng{loaded ? ` (${files.length})` : ""}
      </summary>
      <p>PDF tối đa 10 MB. Tệp riêng tư, chỉ người có quyền được tải.</p>
      {files.map((file) => (
        <p key={file.id}>
          <a href={`/api/files/${file.id}`}>
            {file.kind === "weekly"
              ? `Tuần ${file.weekNumber}`
              : file.kind === "final"
                ? "Báo cáo cuối"
                : "Minh chứng chấm thay"}
            : {file.originalName}
          </a>{" "}
          · {Math.ceil(file.size / 1024)} KB
        </p>
      ))}
      {!loaded && !error && <p role="status">Đang tải danh sách tệp…</p>}
      {loaded && !files.length && <p>Chưa có tệp đính kèm.</p>}
      <button
        className="text-button"
        disabled={busy}
        onClick={() =>
          void load().catch((cause: Error) => setError(cause.message))
        }
      >
        Tải lại danh sách tệp
      </button>
      {targets.length > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(e.currentTarget, false);
          }}
        >
          <p>
            Lưu nội dung báo cáo trước, sau đó đính kèm PDF. Tệp mới thay bản
            đính kèm hiện tại; bản cũ được giữ trong lịch sử hệ thống.
          </p>
          <label>
            Báo cáo cần đính kèm
            <select name="target" required>
              {targets.map((target) => (
                <option key={target.path} value={target.path}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tệp PDF
            <input
              type="file"
              name="file"
              accept="application/pdf,.pdf"
              required
            />
          </label>
          <button className="button secondary" disabled={busy}>
            {busy ? "Đang tải…" : "Lưu tệp PDF"}
          </button>
        </form>
      )}
      {supervisors.length > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(e.currentTarget, true);
          }}
        >
          <h4>Khoa nhập phiếu thay doanh nghiệp</h4>
          <p>
            Thay đúng phiếu của người được chọn, không thêm một phiếu điểm mới.
            Bắt buộc minh chứng và lý do.
          </p>
          <label>
            Người hướng dẫn được chấm thay
            <select name="supervisorId" required>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {[
            ["discipline", "Kỷ luật", 2],
            ["responsibility", "Trách nhiệm", 2],
            ["knowledge", "Vận dụng chuyên môn", 2],
            ["outcome", "Kết quả công việc", 4],
          ].map(([name, label, max]) => (
            <label key={name}>
              {label} (0–{max})
              <input
                type="number"
                name={String(name)}
                min={0}
                max={Number(max)}
                step="0.1"
                required
              />
            </label>
          ))}
          <label>
            Lý do nhập thay
            <textarea name="reason" required minLength={3} maxLength={500} />
          </label>
          <label>
            PDF minh chứng
            <input
              type="file"
              name="file"
              accept="application/pdf,.pdf"
              required
            />
          </label>
          <button className="button secondary" disabled={busy}>
            {busy ? "Đang lưu…" : "Xác nhận lưu phiếu có minh chứng"}
          </button>
        </form>
      )}
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </details>
  );
}
