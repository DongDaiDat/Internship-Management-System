"use client";
import { useEffect, useState } from "react";
import { api, CurrentUser, Role, roleLabels } from "../lib/api";

type UserRecord = Omit<CurrentUser, "permissions"> & {
  isActive: boolean;
  createdAt: string;
};
type UserPage = {
  items: UserRecord[];
  total: number;
  page: number;
  pageSize: number;
};
export function UsersWorkspace({
  user,
  onLogout,
  loggingOut,
}: {
  user: CurrentUser;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const [data, setData] = useState<UserPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<UserPage>(
      `/users?page=${page}&pageSize=10&search=${encodeURIComponent(query)}`,
      { signal: controller.signal },
    )
      .then(setData)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, query, revision]);
  return (
    <div className="admin-workspace">
      <header className="admin-header">
        <span className="auth-mark">interna.</span>
        <span className="admin-badge">QUẢN TRỊ HỆ THỐNG</span>
        <div>
          <strong>{user.fullName}</strong>
          <button
            className="button secondary"
            disabled={loggingOut}
            onClick={onLogout}
          >
            {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
          </button>
        </div>
      </header>
      <main className="admin-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">NỀN TẢNG CHO MỘT KỲ THỰC TẬP TỐT</p>
            <h1>Người dùng</h1>
            <p>Cấp tài khoản và vai trò phù hợp cho từng người tham gia.</p>
          </div>
          {user.permissions.includes("users:create") && (
            <button
              className="button primary"
              onClick={() => {
                setCreating(!creating);
                setNotice("");
              }}
            >
              {creating ? "Đóng biểu mẫu" : "＋ Tạo người dùng"}
            </button>
          )}
        </div>
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {creating && (
          <CreateUser
            onCreated={(email) => {
              setNotice(
                `Đã tạo tài khoản ${email}. Người dùng có thể đăng nhập ngay.`,
              );
              setCreating(false);
              setPage(1);
              setQuery("");
              setSearch("");
              setRevision((value) => value + 1);
            }}
          />
        )}
        <section className="card">
          <div className="section-title">
            <div>
              <h2>Danh sách tài khoản</h2>
              <p>
                {data
                  ? `${data.total} tài khoản trong hệ thống`
                  : "Dữ liệu từ PostgreSQL"}
              </p>
            </div>
            <form
              className="user-search"
              onSubmit={(event) => {
                event.preventDefault();
                setQuery(search.trim());
                setPage(1);
              }}
            >
              <label className="sr-only" htmlFor="user-search">
                Tìm theo tên hoặc email
              </label>
              <input
                id="user-search"
                type="search"
                value={search}
                maxLength={100}
                placeholder="Tìm tên hoặc email…"
                onChange={(event) => setSearch(event.target.value)}
              />
              <button className="button secondary" type="submit">
                Tìm
              </button>
            </form>
          </div>
          {error ? (
            <div className="empty-state" role="alert">
              <p>{error}</p>
              <button
                className="button secondary"
                onClick={() => setRevision((value) => value + 1)}
              >
                Thử lại
              </button>
            </div>
          ) : loading ? (
            <p className="empty-state" role="status">
              Đang tải danh sách…
            </p>
          ) : data?.items.length ? (
            <>
              <div className="table-scroll">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Người dùng</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.fullName}</strong>
                          <small>{item.email}</small>
                        </td>
                        <td>
                          {item.roles.map((role) => (
                            <span className="role-chip" key={role}>
                              {roleLabels[role]}
                            </span>
                          ))}
                        </td>
                        <td>
                          <span
                            className={
                              item.isActive ? "status" : "subtle-badge"
                            }
                          >
                            {item.isActive ? "Hoạt động" : "Đã khóa"}
                          </span>
                        </td>
                        <td>
                          {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>
                  Trang {page} / {Math.max(1, Math.ceil(data.total / 10))}
                </span>
                <div>
                  <button
                    className="button secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Trước
                  </button>
                  <button
                    className="button secondary"
                    disabled={page * 10 >= data.total}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Tiếp
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>Không tìm thấy người dùng</h3>
              <p>Thử tên khác hoặc bỏ bộ lọc để xem đầy đủ danh sách.</p>
              <button
                className="text-button"
                onClick={() => {
                  setSearch("");
                  setQuery("");
                  setPage(1);
                }}
              >
                Xóa tìm kiếm
              </button>
            </div>
          )}
        </section>
        <p className="admin-footnote">
          Chức năng quản lý tài khoản đã kết nối dữ liệu thật. Hồ sơ thực tập và
          quy trình duyệt đang được triển khai.
        </p>
      </main>
    </div>
  );
}

function CreateUser({ onCreated }: { onCreated: (email: string) => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("Student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="card editor create-user">
      <h2>Tạo tài khoản</h2>
      <p>Chỉ cấp quyền cần thiết cho công việc của người dùng.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await api("/users", {
              method: "POST",
              body: JSON.stringify({
                fullName,
                email,
                password,
                roles: [role],
              }),
            });
            setPassword("");
            onCreated(email.trim().toLowerCase());
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Không thể tạo tài khoản.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-row">
          <label>
            Họ và tên
            <input
              required
              minLength={2}
              maxLength={120}
              value={fullName}
              autoComplete="off"
              onChange={(event) => setFullName(event.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              required
              maxLength={254}
              value={email}
              autoComplete="off"
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Mật khẩu ban đầu
            <input
              type="password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
            />
            <small className="password-hint">
              Từ 12 đến 128 ký tự. Chuyển mật khẩu cho người dùng qua kênh
              riêng.
            </small>
          </label>
          <label>
            Vai trò
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              disabled={busy}
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {role === "Admin" && (
          <p className="notice">
            Quản trị hệ thống có quyền xem và tạo tài khoản, bao gồm tài khoản
            quản trị khác.
          </p>
        )}
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? "Đang tạo…" : "Tạo tài khoản"}
        </button>
      </form>
    </section>
  );
}
