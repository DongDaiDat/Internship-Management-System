"use client";
import { useId, useState } from "react";
import { StudentAcademicFields } from "./academic-fields";
import { api } from "../lib/api";
import { validateProfile } from "../lib/profile-validation";
const fields: Record<string, [string, string, string?][]> = {
  students: [
    ["studentCode", "Mã sinh viên"],
    ["fullName", "Họ tên"],
    ["email", "Email liên hệ", "email"],
    ["className", "Lớp"],
    ["programCredits", "Tổng tín chỉ", "number"],
    ["completedCredits", "Tín chỉ hoàn thành", "number"],
    ["hasMandatoryCourseDebt", "Còn nợ học phần bắt buộc", "boolean"],
  ],
  faculty: [
    ["facultyCode", "Mã giảng viên"],
    ["fullName", "Họ tên"],
    ["email", "Email liên hệ", "email"],
    ["expertise", "Chuyên môn"],
    ["maxStudents", "Giới hạn hướng dẫn", "number"],
  ],
  companies: [
    ["name", "Tên doanh nghiệp"],
    ["taxCode", "Mã số thuế"],
    ["address", "Địa chỉ"],
    ["website", "Website"],
    ["contactName", "Người liên hệ"],
    ["contactEmail", "Email liên hệ", "email"],
    ["contactPhone", "Điện thoại"],
  ],
};
export function ProfileEditor({
  type,
  initial,
  onSaved,
}: {
  type: string;
  initial?: Record<string, unknown>;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const errorId = useId();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  return (
    <details className="profile-editor">
      <summary>{initial ? "Sửa hồ sơ" : "Thêm hồ sơ thủ công"}</summary>
      <p>
        Không đổi tài khoản đăng nhập. Hồ sơ sinh viên sau khi chỉnh sửa cần
        được xác minh lại.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = Object.fromEntries(new FormData(form));
          setNotice("");
          const validation = validateProfile(type, data);
          setFieldErrors(validation);
          if (Object.keys(validation).length) {
            setError("");
            const first = fields[type].find(([key]) => validation[key])?.[0];
            if (first)
              (form.elements.namedItem(first) as HTMLElement | null)?.focus();
            return;
          }
          setBusy(true);
          setError("");
          setNotice("");
          try {
            await api(
              initial
                ? `/profiles/${type}/${initial.id}/update`
                : `/profiles/${type}`,
              { method: "POST", body: JSON.stringify({ data }) },
            );
            setNotice("Đã lưu hồ sơ.");
            if (!initial) form.reset();
            onSaved();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Không thể lưu.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {type === "students" && <StudentAcademicFields initial={initial} />}
        {fields[type].map(([key, label, inputType]) => (
          <label key={key}>
            {label}
            {inputType === "boolean" ? (
              <select
                name={key}
                aria-invalid={!!fieldErrors[key]}
                aria-describedby={
                  fieldErrors[key] ? `${errorId}-${key}` : undefined
                }
                defaultValue={String(initial?.[key] ?? false)}
              >
                <option value="false">Không</option>
                <option value="true">Có</option>
              </select>
            ) : (
              <input
                name={key}
                aria-invalid={!!fieldErrors[key]}
                aria-describedby={
                  fieldErrors[key] ? `${errorId}-${key}` : undefined
                }
                type={inputType || "text"}
                defaultValue={String(
                  initial?.[key] ??
                    (key === "major" ? "Công nghệ thông tin" : ""),
                )}
                required={!["major", "taxCode", "website"].includes(key)}
                min={inputType === "number" ? 0 : undefined}
                step={inputType === "number" ? 1 : undefined}
              />
            )}
            {fieldErrors[key] && (
              <small id={`${errorId}-${key}`} className="login-error">
                {fieldErrors[key]}
              </small>
            )}
          </label>
        ))}
        {error && (
          <p role="alert" className="login-error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <button className="button secondary" disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu hồ sơ"}
        </button>
      </form>
    </details>
  );
}
export function StudentContactEditor() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details className="profile-editor">
      <summary>Cập nhật email liên hệ</summary>
      <p>Email đăng nhập và dữ liệu học vụ không thay đổi.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const email = new FormData(e.currentTarget).get("email");
          setBusy(true);
          try {
            await api("/students/me/contact", {
              method: "POST",
              body: JSON.stringify({ email }),
            });
            setMessage("Đã cập nhật email liên hệ.");
          } catch (cause) {
            setMessage(
              cause instanceof Error ? cause.message : "Không thể lưu.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Email liên hệ
          <input type="email" name="email" required maxLength={254} />
        </label>
        <button className="button secondary" disabled={busy}>
          Lưu liên hệ
        </button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
