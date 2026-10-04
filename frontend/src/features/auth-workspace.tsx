"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError, CurrentUser } from "../lib/api";
import { WorkspaceRouter } from "./workspace-router";

export function AuthWorkspace() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const userId = user?.id;
  useEffect(() => {
    const controller = new AbortController();
    function expired() {
      setUser(null);
      setError("");
    }
    window.addEventListener("session-expired", expired);
    setLoading(true);
    api<CurrentUser>("/auth/me", { signal: controller.signal })
      .then(setUser)
      .catch((cause) => {
        if (
          !controller.signal.aborted &&
          !(cause instanceof ApiError && cause.status === 401)
        )
          setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      window.removeEventListener("session-expired", expired);
    };
  }, [retry]);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    function checkSession() {
      if (document.visibilityState === "visible")
        void api<CurrentUser>("/auth/me", { signal: controller.signal })
          .then(setUser)
          .catch(() => undefined);
    }
    window.addEventListener("focus", checkSession);
    const interval = window.setInterval(checkSession, 60_000);
    return () => {
      controller.abort();
      window.removeEventListener("focus", checkSession);
      window.clearInterval(interval);
    };
  }, [userId]);
  async function logout() {
    setLoggingOut(true);
    setError("");
    try {
      await api<void>("/auth/logout", { method: "POST" });
      setUser(null);
    } catch (cause) {
      if (!(cause instanceof ApiError && cause.status === 401))
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể đăng xuất. Vui lòng thử lại.",
        );
    } finally {
      setLoggingOut(false);
    }
  }
  if (loading)
    return (
      <main className="auth-loading" role="status">
        <span className="loading-orbit" />
        <h1>Đang mở không gian của bạn</h1>
        <p>Kiểm tra phiên đăng nhập…</p>
      </main>
    );
  if (!user && error)
    return (
      <main className="auth-loading">
        <h1>Chưa kết nối được hệ thống</h1>
        <p role="alert">{error}</p>
        <button
          className="button primary"
          onClick={() => {
            setError("");
            setRetry((value) => value + 1);
          }}
        >
          Thử lại
        </button>
        <Link className="text-button" href="/demo">
          Xem giao diện mẫu
        </Link>
      </main>
    );
  if (!user) return <LoginForm onLogin={setUser} />;
  if (user.mustChangePassword)
    return (
      <ChangePassword
        user={user}
        onChanged={() => setUser({ ...user, mustChangePassword: false })}
        onLogout={logout}
        loggingOut={loggingOut}
        logoutError={error}
      />
    );
  return (
    <>
      {error && (
        <div className="session-error" role="alert">
          {error}
        </div>
      )}
      <WorkspaceRouter user={user} onLogout={logout} loggingOut={loggingOut} />
    </>
  );
}

function ChangePassword({
  user,
  onChanged,
  onLogout,
  loggingOut,
  logoutError,
}: {
  user: CurrentUser;
  onChanged: () => void;
  onLogout: () => void;
  loggingOut: boolean;
  logoutError: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="auth-loading">
      <span className="auth-mark">PHENIKAA</span>
      <h1>Đổi mật khẩu tạm</h1>
      <p>
        Chào {user.fullName}, bạn cần đặt mật khẩu riêng trước khi sử dụng hệ
        thống.
      </p>
      <form
        className="change-password"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || loggingOut) return;
          if (password !== confirm)
            return setError("Mật khẩu xác nhận chưa khớp.");
          setBusy(true);
          setError("");
          try {
            await api("/auth/change-password", {
              method: "POST",
              body: JSON.stringify({ currentPassword, password }),
            });
            onChanged();
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Không thể đổi mật khẩu.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Mật khẩu tạm được cấp
          <input
            type="password"
            autoComplete="current-password"
            maxLength={128}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label>
          Mật khẩu mới
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <label>
          Xác nhận mật khẩu
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </label>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        {logoutError && <p role="alert">{logoutError}</p>}
        <button className="button primary" disabled={busy || loggingOut}>
          {busy ? "Đang lưu…" : "Lưu mật khẩu mới"}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={onLogout}
          disabled={busy || loggingOut}
        >
          {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
        </button>
      </form>
    </main>
  );
}

function LoginForm({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="login-page">
      <section className="login-story">
        <Link href="/demo" className="auth-mark">
          PHENIKAA<span>.</span>
        </Link>
        <div>
          <p className="eyebrow">TỪ GIẢNG ĐƯỜNG ĐẾN THỰC TIỄN</p>
          <h2>
            Một hành trình mới.
            <br />
            Nhiều điều để khám phá.
          </h2>
          <p>
            Theo dõi thực tập, kết nối với người hướng dẫn và lưu lại từng bước
            trưởng thành của bạn.
          </p>
          <div className="story-track">
            <span>
              01
              <br />
              <strong>Kết nối</strong>
            </span>
            <i />
            <span>
              02
              <br />
              <strong>Trải nghiệm</strong>
            </span>
            <i />
            <span>
              03
              <br />
              <strong>Trưởng thành</strong>
            </span>
          </div>
        </div>
        <small>Không gian đồng hành cùng kỳ thực tập tốt nghiệp</small>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <span className="login-symbol">↗</span>
          <p className="eyebrow">CHÀO MỪNG BẠN TRỞ LẠI</p>
          <h1>Đăng nhập Phenikaa</h1>
          <p>Mọi việc cho kỳ thực tập, gọn trong một nơi.</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                const result = await api<CurrentUser>("/auth/login", {
                  method: "POST",
                  body: JSON.stringify({ email: email.trim(), password }),
                });
                setPassword("");
                onLogin(result);
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Không thể đăng nhập.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="Email do nhà trường cấp"
              maxLength={254}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
            />
            <label htmlFor="login-password">Mật khẩu</label>
            <div className="password-input">
              <input
                id="login-password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                aria-pressed={visible}
              >
                {visible ? "Ẩn" : "Hiện"}
              </button>
            </div>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary login-submit"
              disabled={busy}
              type="submit"
            >
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="login-help">
            Chưa có tài khoản hoặc cần cấp lại mật khẩu? Liên hệ quản trị hệ
            thống của trường.
          </p>
          <div className="login-demo">
            <span>Muốn khám phá giao diện trước?</span>
            <Link href="/demo">Xem bản trải nghiệm →</Link>
          </div>
        </div>
        <p className="login-footer">
          Kết nối nhà trường · Sinh viên · Doanh nghiệp
        </p>
      </section>
    </main>
  );
}
