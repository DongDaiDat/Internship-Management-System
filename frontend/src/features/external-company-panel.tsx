"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
type Application = {
  id: string;
  externalCompanyName: string;
  externalCompanyContact: string | null;
  externalCompanyEmail: string | null;
  student: { fullName: string; studentCode: string };
  period: { name: string };
};
export function ExternalCompanyPanel() {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(
    async () =>
      setItems(await api<Application[]>("/external-company-applications")),
    [],
  );
  useEffect(() => {
    void load()
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [load]);
  async function verify(id: string, body: object) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/internship-applications/${id}/verify-company`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setNotice(
        "Đã xác minh và liên kết doanh nghiệp. Hồ sơ có thể tiếp tục được khoa xét duyệt; tài khoản doanh nghiệp được cấp riêng tại mục Hồ sơ và cấp tài khoản.",
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xác minh.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card editor student-portal">
      <h2>Công ty sinh viên tự tìm</h2>
      <p>
        Xác nhận thông tin liên hệ trước khi đưa hồ sơ sang bước phê duyệt. Công
        ty đã xác minh trùng tên và email sẽ được liên kết lại, không ghi đè
        thông tin.
      </p>
      {error && (
        <p className="login-error" role="alert">
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
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p className="empty-state">Đang tải…</p>
      ) : (
        !items.length && (
          <p className="empty-state">
            Không có công ty tự tìm đang chờ xác minh.
          </p>
        )
      )}
      {items.map((a) => (
        <details className="portal-entry" key={a.id}>
          <summary>
            {a.externalCompanyName} · {a.student.fullName}
          </summary>
          <p>
            {a.student.studentCode} · {a.period.name}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verify(
                a.id,
                Object.fromEntries(new FormData(e.currentTarget)),
              );
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Tên công ty
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={160}
                  defaultValue={a.externalCompanyName}
                />
              </label>
              <label>
                Địa chỉ
                <input name="address" required minLength={3} maxLength={255} />
              </label>
              <label>
                Người liên hệ
                <input
                  name="contactName"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={a.externalCompanyContact || ""}
                />
              </label>
              <label>
                Email liên hệ
                <input
                  name="contactEmail"
                  type="email"
                  required
                  maxLength={254}
                  defaultValue={a.externalCompanyEmail || ""}
                />
              </label>
              <label>
                Số điện thoại
                <input
                  name="contactPhone"
                  type="tel"
                  required
                  minLength={5}
                  maxLength={30}
                />
              </label>
              <label>
                Ghi chú xác minh
                <textarea name="note" required minLength={3} maxLength={500} />
              </label>
              <label>
                <input type="checkbox" required /> Tôi đã kiểm tra thông tin
                doanh nghiệp
              </label>
              <button className="button primary">
                Xác minh và liên kết hồ sơ
              </button>
            </fieldset>
          </form>
        </details>
      ))}
    </section>
  );
}
