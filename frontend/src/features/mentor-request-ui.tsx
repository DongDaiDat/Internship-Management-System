"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
export type MentorRequest = {
  id: string;
  facultyMentorId: string;
  facultyMentor: { id: string; fullName: string };
  reason: string;
  response: "Pending" | "Accepted" | "Declined";
  responseNote: string | null;
  createdAt: string;
  respondedAt: string | null;
  closedAt: string | null;
  closeReason: string | null;
};
type Choice = {
  id: string;
  fullName: string;
  expertise: string;
  assignedCount: number;
  maxStudents: number;
  available: boolean;
};
export const responseLabels = {
  Pending: "Chờ giảng viên phản hồi",
  Accepted: "Giảng viên đồng ý",
  Declined: "Giảng viên từ chối",
};
const closeLabels: Record<string, string> = {
  Replaced: "Đã thay đề xuất",
  Withdrawn: "Đã rút",
  Cancelled: "Hồ sơ đã hủy",
  Rejected: "Hồ sơ bị từ chối",
  Assigned: "Khoa đã phân công",
};
export function MentorHistory({
  requests = [],
  assigned,
}: {
  requests?: MentorRequest[];
  assigned?: string;
}) {
  const current = requests.find((r) => !r.closedAt);
  return (
    <div className="mentor-request-summary">
      <p>
        <strong>Nguyện vọng hiện tại: </strong>
        {current
          ? `${current.facultyMentor.fullName} · ${responseLabels[current.response]}`
          : "Không có đề xuất đang chờ; khoa phân công."}
      </p>
      {current && (
        <>
          <p>Lý do: {current.reason}</p>
          {current.responseNote && <p>Phản hồi: {current.responseNote}</p>}
        </>
      )}
      {assigned && (
        <p className="notice">
          <strong>Giảng viên phân công:</strong> {assigned}
        </p>
      )}
      {!!requests.length && (
        <details>
          <summary>Lịch sử đề xuất ({requests.length})</summary>
          <ol>
            {requests.map((r) => (
              <li key={r.id}>
                <strong>{r.facultyMentor.fullName}</strong> ·{" "}
                {responseLabels[r.response]} ·{" "}
                {new Date(r.createdAt).toLocaleString("vi-VN")}
                <p>{r.reason}</p>
                {r.responseNote && <p>Phản hồi: {r.responseNote}</p>}
                {r.closedAt && (
                  <p>
                    {closeLabels[r.closeReason ?? ""] ?? "Đã kết thúc"} ·{" "}
                    {new Date(r.closedAt).toLocaleString("vi-VN")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
export function MentorFields({
  periodId,
  fieldNames = ["proposedMentorId", "mentorReason"],
}: {
  periodId: string;
  fieldNames?: [string, string];
}) {
  const [enabled, setEnabled] = useState(false);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled || !periodId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setChoices([]);
    void api<Choice[]>(`/internship-periods/${periodId}/mentor-choices`, {
      signal: controller.signal,
    })
      .then(setChoices)
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [periodId, enabled, retry]);
  return (
    <div className="mentor-request-fields">
      <label>
        Nguyện vọng hướng dẫn
        <select
          aria-label="Nguyện vọng hướng dẫn"
          value={enabled ? "propose" : "faculty"}
          onChange={(e) => setEnabled(e.target.value === "propose")}
        >
          <option value="faculty">Để khoa phân công</option>
          <option value="propose">Đề xuất giảng viên</option>
        </select>
      </label>
      {enabled && (
        <>
          <p className="info-note">
            Đồng ý hướng dẫn chưa phải là phân công chính thức và không giữ chỉ
            tiêu.
          </p>
          {!periodId && <p>Chọn đợt thực tập để xem giảng viên.</p>}
          {loading && <p role="status">Đang tải giảng viên…</p>}
          {error && (
            <p className="login-error" role="alert">
              {error}{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => setRetry((v) => v + 1)}
              >
                Thử lại
              </button>
            </p>
          )}
          <label>
            Giảng viên mong muốn
            <select
              key={periodId}
              aria-label="Giảng viên mong muốn"
              name={fieldNames[0]}
              required
              defaultValue=""
            >
              <option value="" disabled>
                {loading ? "Đang tải…" : "Chọn giảng viên"}
              </option>
              {choices.map((f) => (
                <option key={f.id} value={f.id} disabled={!f.available}>
                  {f.fullName} · {f.expertise} · {f.assignedCount}/
                  {f.maxStudents}
                  {!f.available ? " · Hết chỉ tiêu" : ""}
                </option>
              ))}
            </select>
          </label>
          {periodId && !loading && !error && !choices.length && (
            <p className="empty-state">
              Chưa có giảng viên phù hợp. Bạn có thể để khoa phân công.
            </p>
          )}
          <label>
            Lý do đề xuất
            <textarea
              name={fieldNames[1]}
              required
              minLength={10}
              maxLength={500}
              placeholder="Nêu lĩnh vực thực tập và lý do mong muốn thầy/cô hướng dẫn."
            />
          </label>
        </>
      )}
    </div>
  );
}
export function StudentMentorEditor({
  id,
  periodId,
  requests,
  busy,
  mutate,
}: {
  id: string;
  periodId: string;
  requests: MentorRequest[];
  busy: boolean;
  mutate: (path: string, body: object, message: string) => Promise<boolean>;
}) {
  const [revision, setRevision] = useState(0);
  return (
    <details>
      <summary>Thay đổi nguyện vọng hướng dẫn</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fields = Object.fromEntries(new FormData(e.currentTarget));
          const proposing = !!fields.facultyMentorId;
          if (
            await mutate(
              `/internship-applications/${id}/mentor-request${proposing ? "" : "/withdraw"}`,
              proposing ? fields : {},
              proposing
                ? "Đã gửi đề xuất mới để giảng viên phản hồi."
                : "Đã chuyển sang để khoa phân công.",
            )
          )
            setRevision((v) => v + 1);
        }}
      >
        <fieldset disabled={busy}>
          <MentorFields
            key={revision}
            periodId={periodId}
            fieldNames={["facultyMentorId", "reason"]}
          />
          <p className="info-note">
            Lưu sẽ thay thế đề xuất hiện tại
            {requests.some((r) => !r.closedAt)
              ? " và kết thúc hiệu lực phản hồi cũ"
              : ""}
            . Lịch sử được giữ lại.
          </p>
          <button className="button secondary">
            {busy ? "Đang lưu…" : "Lưu nguyện vọng"}
          </button>
        </fieldset>
      </form>
    </details>
  );
}
