"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "../lib/api";

type Task = {
  id: string;
  type: string;
  title: string;
  context: string;
  href: string;
  priority: string;
  dueAt: string | null;
  count: number;
  hiddenUntil?: string;
  period: { id: string; name: string } | null;
  blocked: boolean;
  actionLabel: string;
};
type Data = {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
  options: {
    types: { id: string; name: string }[];
    periods: { id: string; name: string }[];
  };
};
type Summary = {
  total: number;
  counts: Record<string, number>;
  computedAt: string;
};
const labels: Record<string, string> = {
  overdue: "Quá hạn",
  urgent: "Trong 24 giờ",
  soon: "Trong 3 ngày",
  pending: "Cần xử lý",
};
const NotificationContext = createContext<{
  summary: Summary | null;
  data: Data | null;
  error: string;
  loading: boolean;
  refresh: () => void;
  snooze: (taskId: string) => Promise<void>;
  restore: (taskId: string) => Promise<void>;
}>({
  summary: null,
  data: null,
  error: "",
  loading: true,
  refresh: () => {},
  snooze: async () => {},
  restore: async () => {},
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<Summary | null>(null),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setLoading(true);
    void Promise.all([
      api<Summary>("/notifications/summary", { signal: c.signal }),
      api<Data>("/notifications/tasks?pageSize=8", { signal: c.signal }),
    ])
      .then(([s, d]) => {
        if (!c.signal.aborted) {
          setSummary(s);
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
  }, []);
  const snooze = useCallback(
    async (taskId: string) => {
      await api(`/notifications/tasks/${encodeURIComponent(taskId)}/snooze`, {
        method: "POST",
      });
      refresh();
    },
    [refresh],
  );
  const restore = useCallback(
    async (taskId: string) => {
      await api(`/notifications/tasks/${encodeURIComponent(taskId)}/snooze`, {
        method: "DELETE",
      });
      refresh();
    },
    [refresh],
  );
  useEffect(() => {
    refresh();
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(visible, 60000);
    window.addEventListener("workspace-mutated", refresh);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller.current?.abort();
      clearInterval(timer);
      window.removeEventListener("workspace-mutated", refresh);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  return (
    <NotificationContext.Provider
      value={{ summary, data, error, loading, refresh, snooze, restore }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
function TaskRows({
  items,
  onNavigate,
  visibility = "active",
  onSnooze,
  onRestore,
}: {
  items: Task[];
  onNavigate?: () => void;
  visibility?: "active" | "hidden";
  onSnooze?: (taskId: string) => Promise<void>;
  onRestore?: (taskId: string) => Promise<void>;
}) {
  const [working, setWorking] = useState<string | null>(null),
    [actionError, setActionError] = useState("");
  const mutate = async (
    taskId: string,
    action?: (id: string) => Promise<void>,
  ) => {
    if (!action) return;
    setActionError("");
    setWorking(taskId);
    try {
      await action(taskId);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Không cập nhật được trạng thái nhắc việc.",
      );
    } finally {
      setWorking(null);
    }
  };
  return (
    <ul className="notification-list">
      {items.map((t) => (
        <li key={t.id} className={`notification-item priority-${t.priority}`}>
          <div className="notification-item-heading">
            <strong>{t.title}</strong>
            <span className={`notification-priority priority-${t.priority}`}>
              {labels[t.priority]}
            </span>
          </div>
          <p>
            {[t.context, t.period?.name].filter(Boolean).join(" · ")}
            {t.count > 1 ? ` · ${t.count} hồ sơ` : ""}
          </p>
          <small>
            {t.dueAt
              ? `Hạn: ${new Date(t.dueAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" })}`
              : "Chưa có hạn xử lý"}
          </small>
          {visibility === "hidden" && t.hiddenUntil && (
            <small>
              Hiện lại lúc:{" "}
              {new Date(t.hiddenUntil).toLocaleString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
                dateStyle: "short",
                timeStyle: "short",
              })}
            </small>
          )}
          {t.blocked && (
            <p className="notification-blocked">
              Thao tác đang bị giới hạn bởi lịch của đợt hoặc trạng thái hồ sơ.
              Xem tình trạng và liên hệ người phụ trách để được hỗ trợ.
            </p>
          )}
          <Link onClick={onNavigate} href={t.href}>
            {t.actionLabel} →
          </Link>
          {visibility === "active" ? (
            <button
              className="notification-snooze"
              type="button"
              disabled={working === t.id}
              onClick={() => void mutate(t.id, onSnooze)}
            >
              {working === t.id ? "Đang ẩn…" : "Ẩn đến 08:00 ngày mai"}
            </button>
          ) : (
            <button
              className="notification-snooze"
              type="button"
              disabled={working === t.id}
              onClick={() => void mutate(t.id, onRestore)}
            >
              {working === t.id ? "Đang khôi phục…" : "Hiện lại"}
            </button>
          )}
        </li>
      ))}
      {actionError && <li role="alert">{actionError}</li>}
    </ul>
  );
}
export function NotificationBell() {
  const { summary, data, error, loading, refresh, snooze } =
    useContext(NotificationContext);
  const [open, setOpen] = useState(false),
    ref = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname(),
    root = pathname.split("/").slice(0, 3).join("/");
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const urgent =
    !!summary && summary.counts.overdue + summary.counts.urgent > 0;
  return (
    <div
      className="notification-anchor"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={button}
        className="notification-bell"
        aria-label={`Việc cần làm${summary ? `: ${summary.total}` : ""}${error ? ", chưa cập nhật được" : ""}`}
        aria-expanded={open}
        aria-controls="notification-popover"
        onClick={() => {
          setOpen(!open);
          if (!open) refresh();
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {!!summary?.total && (
          <span
            aria-hidden="true"
            className={`notification-badge ${urgent ? "is-urgent" : ""}`}
          >
            {summary.total > 99 ? "99+" : summary.total}
          </span>
        )}
        {error && (
          <span className="notification-error-dot" aria-hidden="true">
            !
          </span>
        )}
      </button>
      {open && (
        <section
          id="notification-popover"
          className="notification-popover"
          aria-label="Nhắc việc"
        >
          <div className="notification-toolbar">
            <h2>Việc cần làm{summary ? ` (${summary.total})` : ""}</h2>
            <button
              className="text-button"
              disabled={loading}
              onClick={refresh}
            >
              Làm mới
            </button>
          </div>
          {error && (
            <p role="alert">
              Không cập nhật được nhắc việc.{" "}
              {data
                ? "Đang hiển thị dữ liệu lần tải trước."
                : "Vui lòng thử lại."}
            </p>
          )}
          {loading && <p role="status">Đang cập nhật…</p>}
          {data && (
            <TaskRows
              items={data.items}
              onNavigate={() => setOpen(false)}
              onSnooze={snooze}
            />
          )}
          {!error && !loading && data?.total === 0 && (
            <p className="empty-state">Bạn không có việc cần xử lý lúc này.</p>
          )}
          <Link
            className="notification-all"
            href={`${root}/tasks`}
            onClick={() => setOpen(false)}
          >
            Xem tất cả việc cần làm →
          </Link>
        </section>
      )}
    </div>
  );
}
export function TasksPreview() {
  const { data, error, loading, refresh, snooze } =
      useContext(NotificationContext),
    pathname = usePathname(),
    root = pathname.split("/").slice(0, 3).join("/");
  return (
    <section className="card notification-preview">
      <div className="notification-toolbar">
        <h2>Việc cần xử lý</h2>
        <Link href={`${root}/tasks`}>Xem tất cả</Link>
      </div>
      {error && (
        <p role="alert">
          Không tải được nhắc việc. <button onClick={refresh}>Thử lại</button>
        </p>
      )}
      {loading && !data && <p role="status">Đang tải…</p>}
      {data && <TaskRows items={data.items.slice(0, 4)} onSnooze={snooze} />}
      {!error && !loading && data?.total === 0 && (
        <p>Không có công việc cần xử lý.</p>
      )}
    </section>
  );
}
export function TasksPage() {
  const params = useSearchParams(),
    pathname = usePathname(),
    router = useRouter(),
    query = params.toString();
  const { summary, refresh } = useContext(NotificationContext);
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0),
    [search, setSearch] = useState(params.get("search") || "");
  useEffect(() => {
    setSearch(params.get("search") || "");
  }, [params]);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    api<Data>(`/notifications/tasks?${query}`, { signal: c.signal })
      .then((d) => {
        if (!c.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [query, retry, summary?.computedAt]);
  const change = (key: string, value: string) => {
    const q = new URLSearchParams(query);
    if (value) q.set(key, value);
    else q.delete(key);
    if (key !== "page") q.delete("page");
    router.push(`${pathname}?${q}`);
  };
  const visibility = (params.get("visibility") || "active") as
    "active" | "hidden";
  const mutate = async (taskId: string, action: "snooze" | "restore") => {
    await api(`/notifications/tasks/${encodeURIComponent(taskId)}/snooze`, {
      method: action === "snooze" ? "POST" : "DELETE",
    });
    refresh();
    setRetry((value) => value + 1);
  };
  const select = (
    key: string,
    label: string,
    options: { id: string; name: string }[],
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={params.get(key) || ""}
        onChange={(e) => change(key, e.target.value)}
      >
        <option value="">Tất cả</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="card notification-page">
      <p>
        Việc tự cập nhật theo hồ sơ thực tế. Bạn có thể tạm ẩn một việc đến
        08:00 ngày mai mà không làm thay đổi trạng thái nghiệp vụ.
      </p>
      <div
        className="notification-visibility"
        role="tablist"
        aria-label="Trạng thái hiển thị"
      >
        <button
          type="button"
          role="tab"
          aria-selected={visibility === "active"}
          className={visibility === "active" ? "is-selected" : ""}
          onClick={() => change("visibility", "active")}
        >
          Đang hiện
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={visibility === "hidden"}
          className={visibility === "hidden" ? "is-selected" : ""}
          onClick={() => change("visibility", "hidden")}
        >
          Đã tạm ẩn
        </button>
      </div>
      <form
        className="summary-search"
        onSubmit={(e) => {
          e.preventDefault();
          change("search", search.trim());
        }}
      >
        <label htmlFor="task-search">Tìm công việc</label>
        <input
          id="task-search"
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nội dung, sinh viên hoặc đợt"
        />
        <button className="button primary">Tìm kiếm</button>
        <button
          className="button secondary"
          type="button"
          onClick={() => router.push(pathname)}
        >
          Xóa bộ lọc
        </button>
      </form>
      <div className="summary-filters">
        {select(
          "priority",
          "Mức ưu tiên",
          Object.entries(labels).map(([id, name]) => ({ id, name })),
        )}
        {select("type", "Loại công việc", data?.options.types || [])}
        {select("periodId", "Đợt thực tập", data?.options.periods || [])}
      </div>
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setRetry((v) => v + 1)}>Thử lại</button>
        </p>
      )}
      {loading ? (
        <p role="status">Đang tải công việc…</p>
      ) : (
        !error &&
        data && (
          <>
            <p>
              <strong>{data.total}</strong> việc phù hợp
            </p>
            <TaskRows
              items={data.items}
              visibility={visibility}
              onSnooze={(taskId) => mutate(taskId, "snooze")}
              onRestore={(taskId) => mutate(taskId, "restore")}
            />
            {!data.total && (
              <p className="empty-state">
                Không có công việc phù hợp với bộ lọc.
              </p>
            )}
            <nav
              className="notification-pagination"
              aria-label="Phân trang công việc"
            >
              <button
                className="button secondary"
                disabled={data.page <= 1}
                onClick={() => change("page", String(data.page - 1))}
              >
                Trước
              </button>
              <span>
                Trang {data.page} /{" "}
                {Math.max(1, Math.ceil(data.total / data.pageSize))}
              </span>
              <button
                className="button secondary"
                disabled={data.page * data.pageSize >= data.total}
                onClick={() => change("page", String(data.page + 1))}
              >
                Sau
              </button>
            </nav>
          </>
        )
      )}
    </section>
  );
}
