"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, CurrentUser, Role, roleLabels } from "../lib/api";
import { Choice, useCatalog } from "./academic-fields";
type Credential = {
  roles?: Role[];
  fullName?: string;
  email?: string;
  temporaryPassword?: string;
  status?: string;
  reason?: string;
  id?: string;
  type?: string;
};
export function downloadCsv(rows: string[][], name: string) {
  const escaped = rows
    .map((row) =>
      row
        .map(
          (value) =>
            '"' +
            (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll(
              '"',
              '""',
            ) +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", escaped], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function Credentials({
  rows,
  onClose,
}: {
  rows: Credential[];
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const created = rows.filter((r) => r.temporaryPassword);
  return (
    <section className="card credentials">
      <div className="section-title">
        <div>
          <span className="eyebrow">KẾT QUẢ CẤP TÀI KHOẢN</span>
          <h2>{created.length} tài khoản đã sẵn sàng</h2>
        </div>
        <button className="text-button" onClick={onClose}>
          Đóng kết quả
        </button>
      </div>
      <p>
        Mật khẩu tạm chỉ hiển thị trong lần cấp này. Người dùng cần đổi mật khẩu
        khi đăng nhập.
      </p>
      <div className="toolbar">
        <button
          className="button secondary"
          onClick={() => setVisible(!visible)}
        >
          {visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        </button>
        <button
          className="button primary"
          disabled={!created.length}
          onClick={() =>
            downloadCsv(
              [
                ["Họ tên", "Email", "Vai trò", "Mật khẩu tạm"],
                ...created.map((r) => [
                  r.fullName || "",
                  r.email || "",
                  (r.roles || []).map((role) => roleLabels[role]).join(", "),
                  r.temporaryPassword!,
                ]),
              ],
              "tai-khoan-moi.csv",
            )
          }
        >
          Tải danh sách CSV
        </button>
      </div>
      <div className="table-scroll">
        <table className="users-table">
          <thead>
            <tr>
              <th>Tài khoản / Hồ sơ</th>
              <th>Kết quả</th>
              <th>Mật khẩu tạm</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <strong>{r.fullName || r.id}</strong>
                  <small>{r.email}</small>
                  <small>
                    {(r.roles || []).map((role) => roleLabels[role]).join(", ")}
                  </small>
                </td>
                <td>{r.reason || "Đã cấp thành công"}</td>
                <td>
                  {r.temporaryPassword && (
                    <>
                      <code>
                        {visible ? r.temporaryPassword : "••••••••••••"}
                      </code>
                      <button
                        className="text-button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              r.temporaryPassword!,
                            );
                            setMessage("Đã sao chép mật khẩu.");
                          } catch {
                            setVisible(true);
                            setMessage(
                              "Hãy chọn và sao chép mật khẩu hiển thị.",
                            );
                          }
                        }}
                      >
                        Sao chép
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
type Account = CurrentUser & {
  isActive: boolean;
  department?: { name: string };
};
export function AccountCenter({
  mode,
  user,
}: {
  mode: "accounts" | "pending";
  user: CurrentUser;
}) {
  const { catalog, error: catalogError } = useCatalog();
  const [accounts, setAccounts] = useState<Account[]>([]),
    [pending, setPending] = useState<
      (Credential & {
        department?: { name: string };
        importBatchId?: string;
        ready: boolean;
      })[]
    >([]);
  const [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const [department, setDepartment] = useState(""),
    [type, setType] = useState(""),
    [batch, setBatch] = useState("");
  const [selected, setSelected] = useState<string[]>([]),
    [results, setResults] = useState<Credential[]>([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false),
    [editing, setEditing] = useState<Account | null>(null);
  const [role, setRole] = useState<Role>("Student"),
    [newDepartment, setNewDepartment] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === "accounts") {
        const data = await api<{ items: Account[]; total: number }>(
          `/users?${new URLSearchParams({ page: String(page), search })}`,
        );
        setAccounts(data.items);
        setTotal(data.total);
      } else {
        const data = await api<typeof pending>(
          `/users/pending?${new URLSearchParams({ ...(department ? { departmentId: department } : {}), ...(type ? { type } : {}), ...(batch ? { importBatchId: batch } : {}) })}`,
        );
        setPending(data);
        setSelected([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [mode, page, search, department, type, batch]);
  useEffect(() => {
    void load();
  }, [load]);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const values = Object.fromEntries(new FormData(e.currentTarget));
      const result = await api<Credential>("/users", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          roles: [role],
          ...(newDepartment ? { departmentId: newDepartment } : {}),
        }),
      });
      setResults([result]);
      setCreateOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tạo tài khoản.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-title">
        <p>
          {mode === "pending"
            ? "Cấp tài khoản từ hồ sơ đã được điều phối viên chuẩn bị."
            : "Quản lý tài khoản và quyền truy cập của từng người dùng."}
        </p>
        {mode === "accounts" && (
          <button
            className="button primary"
            onClick={() => setCreateOpen(!createOpen)}
          >
            ＋ Tạo tài khoản
          </button>
        )}
      </div>
      {(error || catalogError) && (
        <p className="login-error" role="alert">
          {error || catalogError}
        </p>
      )}
      {!!results.length && (
        <Credentials rows={results} onClose={() => setResults([])} />
      )}
      {createOpen && (
        <section className="card">
          <h2>Tạo tài khoản</h2>
          <form className="editor" onSubmit={create}>
            <div className="form-row">
              <label>
                Họ tên
                <input name="fullName" required maxLength={120} />
              </label>
              <label>
                Email đăng nhập
                <input name="email" type="email" required />
              </label>
            </div>
            <div className="form-row">
              <label>
                Vai trò
                <select
                  aria-label="Vai trò"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {catalog && (
                <Choice
                  label="Khoa"
                  required={[
                    "FacultyManager",
                    "InternshipCoordinator",
                    "FacultyMentor",
                  ].includes(role)}
                  value={newDepartment}
                  onChange={setNewDepartment}
                  items={catalog.departments.filter((d) => d.isActive)}
                />
              )}
            </div>
            <p className="info-note">
              Mật khẩu tạm được tạo tự động khi lưu. Tài khoản sinh viên/giảng
              viên/doanh nghiệp có hồ sơ nên được cấp tại mục Chờ cấp tài khoản.
            </p>
            <button className="button primary" disabled={busy}>
              {busy ? "Đang tạo…" : "Tạo và nhận mật khẩu"}
            </button>
          </form>
        </section>
      )}
      {editing && (
        <section className="card">
          <h2>Quyền truy cập · {editing.fullName}</h2>
          <form
            className="editor"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const roles = new FormData(e.currentTarget).getAll("roles");
                await api(`/users/${editing.id}/access`, {
                  method: "POST",
                  body: JSON.stringify({
                    roles,
                    ...(newDepartment ? { departmentId: newDepartment } : {}),
                  }),
                });
                setEditing(null);
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Không lưu được.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="role-options">
              {Object.entries(roleLabels).map(([r, label]) => (
                <label key={r}>
                  <input
                    type="checkbox"
                    name="roles"
                    value={r}
                    defaultChecked={editing.roles.includes(r as Role)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {catalog && (
              <Choice
                label="Khoa"
                required={false}
                value={newDepartment}
                onChange={setNewDepartment}
                items={catalog.departments}
              />
            )}
            <div className="toolbar">
              <button className="button primary" disabled={busy}>
                Lưu quyền
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditing(null)}
              >
                Hủy
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="card">
        <div className="toolbar">
          {mode === "accounts" ? (
            <label>
              Tìm tài khoản
              <input
                placeholder="Tên hoặc email…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
          ) : (
            <>
              {catalog && (
                <label>
                  Khoa
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="">Tất cả khoa</option>
                    {catalog.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Loại hồ sơ
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">Tất cả</option>
                  <option value="student">Sinh viên</option>
                  <option value="faculty">Giảng viên</option>
                  <option value="company">Doanh nghiệp</option>
                </select>
              </label>
              <label>
                Lô import
                <select
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                >
                  <option value="">Tất cả lô / Hồ sơ thủ công</option>
                  {[
                    ...new Set([
                      ...pending.map((p) => p.importBatchId || ""),
                      batch,
                    ]),
                  ]
                    .filter(Boolean)
                    .map((id) => (
                      <option key={id} value={id}>
                        Lô {id.slice(0, 8)}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}
        </div>
        {loading ? (
          <p className="empty-state" role="status">
            Đang tải dữ liệu…
          </p>
        ) : mode === "accounts" ? (
          <>
            <div className="table-scroll">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Vai trò / Khoa</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.fullName}</strong>
                        <small>{a.email}</small>
                      </td>
                      <td>
                        {a.roles.map((r) => roleLabels[r]).join(", ")}
                        <small>{a.department?.name || "Chưa gán khoa"}</small>
                      </td>
                      <td>
                        <span className="status">
                          {a.mustChangePassword
                            ? "Cần đổi mật khẩu"
                            : "Đang hoạt động"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="text-button"
                          disabled={busy || a.id === user.id}
                          onClick={() => {
                            setEditing(a);
                            setNewDepartment(a.departmentId || "");
                          }}
                        >
                          Phân quyền
                        </button>
                        <button
                          className="text-button"
                          disabled={busy || a.id === user.id}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Tạo mật khẩu tạm mới và đăng xuất các phiên của ${a.fullName}?`,
                              )
                            )
                              return;
                            setBusy(true);
                            try {
                              setResults([
                                await api<Credential>(
                                  `/users/${a.id}/reset-password`,
                                  { method: "POST" },
                                ),
                              ]);
                              await load();
                            } catch (e) {
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : "Không thể đặt lại.",
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Đặt lại mật khẩu
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!accounts.length && (
              <p className="empty-state">Chưa có tài khoản phù hợp.</p>
            )}
            <div className="pagination">
              <span>
                {total} tài khoản · Trang {page}
              </span>
              <button
                className="button secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Trước
              </button>
              <button
                className="button secondary"
                disabled={page * 10 >= total}
                onClick={() => setPage(page + 1)}
              >
                Sau
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="toolbar">
              <button
                className="button secondary"
                onClick={() =>
                  setSelected(
                    pending
                      .filter((p) => p.ready)
                      .slice(0, 100)
                      .map((p) => p.type + ":" + p.id),
                  )
                }
              >
                Chọn tối đa 100 hồ sơ đủ điều kiện
              </button>
              <button
                className="button primary"
                disabled={busy || !selected.length}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const data = await api<{ results: Credential[] }>(
                      "/users/provision",
                      {
                        method: "POST",
                        body: JSON.stringify({
                          items: selected.map((key) => {
                            const [type, id] = key.split(":");
                            return { type, id };
                          }),
                        }),
                      },
                    );
                    setResults(data.results);
                    await load();
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Không thể cấp tài khoản.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Đang cấp…" : `Cấp ${selected.length} tài khoản`}
              </button>
            </div>
            <div className="table-scroll">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Chọn</th>
                    <th>Hồ sơ</th>
                    <th>Khoa</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((p) => {
                    const key = p.type + ":" + p.id;
                    return (
                      <tr key={key}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${p.fullName}`}
                            disabled={!p.ready || busy}
                            checked={selected.includes(key)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, key].slice(0, 100)
                                  : selected.filter((k) => k !== key),
                              )
                            }
                          />
                        </td>
                        <td>
                          <strong>{p.fullName}</strong>
                          <small>{p.email}</small>
                        </td>
                        <td>{p.department?.name || "Chưa gán khoa"}</td>
                        <td>
                          {p.ready
                            ? "Sẵn sàng cấp"
                            : "Cần hoàn thiện / xác minh"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!pending.length && (
              <p className="empty-state">Không có hồ sơ chờ cấp tài khoản.</p>
            )}
          </>
        )}
      </section>
    </>
  );
}
