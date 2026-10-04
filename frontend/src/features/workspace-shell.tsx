"use client";
import { ReactNode, useRef, useState } from "react";
import Link from "next/link";
export function WorkspaceIcon({ name = "grid" }: { name?: string }) {
  const paths: Record<string, string> = {
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    people:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    file: "M14 2H5v20h14V7zM14 2v6h5M8 13h8M8 17h5",
    calendar: "M3 5h18v16H3zM3 10h18M7 2v6M17 2v6",
    check: "m5 12 4 4L19 6",
    menu: "M4 6h16M4 12h16M4 18h16",
    cap: "m2 9 10-5 10 5-10 5ZM6 11v6c4 3 8 3 12 0v-6M22 9v7",
  };
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.file} />
    </svg>
  );
}
export function WorkspaceShell({
  children,
  title,
  subtitle,
  name,
  role,
  navigation,
  current,
  logout,
  rolePicker,
  onNavigate,
  variant,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  name: string;
  role: string;
  navigation: { key: string; label: string; href: string; icon: string }[];
  current: string;
  logout: ReactNode;
  rolePicker?: ReactNode;
  onNavigate?: (key: string) => void;
  variant?: "student";
}) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState("");
  const matches = navigation.filter((item) =>
    item.label
      .toLocaleLowerCase("vi")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .includes(
        search
          .toLocaleLowerCase("vi")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d"),
      ),
  );
  return (
    <div
      className={`phenikaa-workspace portal-workspace ${variant === "student" ? "student-workspace" : "staff-workspace"}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") setSearch("");
        if (e.key === "Escape" && open) {
          setOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <a className="skip-link" href="#workspace-content">
        Đến nội dung chính
      </a>
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Đóng menu"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`workspace-sidebar ${open ? "is-open" : ""}`}>
        <Link className="phenikaa-brand" href={navigation[0]?.href || "/"}>
          <span className="phenikaa-emblem">
            <WorkspaceIcon name="cap" />
          </span>
          <span>
            PHENIKAA<small>INTERNSHIP PORTAL</small>
          </span>
        </Link>
        <div className="sidebar-school">Trường Công nghệ thông tin</div>
        <div className="sidebar-caption">KHÔNG GIAN LÀM VIỆC</div>
        {rolePicker}
        <nav aria-label="Chức năng">
          {navigation.map((item) => (
            <Link
              href={item.href}
              key={item.key}
              className={current === item.key ? "active" : ""}
              aria-current={current === item.key ? "page" : undefined}
              onClick={(event) => {
                setOpen(false);
                if (onNavigate) {
                  event.preventDefault();
                  onNavigate(item.key);
                }
              }}
            >
              <WorkspaceIcon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">
            {name.trim().split(" ").at(-1)?.slice(0, 1)}
          </span>
          <div>
            <strong>{name}</strong>
            <small>{role}</small>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <button
            ref={menuButton}
            className="mobile-menu"
            aria-label="Mở menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <WorkspaceIcon name="menu" />
          </button>
          <span className="workspace-breadcrumb">
            Quản lý thực tập <span className="breadcrumb-separator">/</span>{" "}
            <strong>{title}</strong>
          </span>
          {
            <>
              <div className="student-function-search">
                <input
                  aria-label="Tìm kiếm chức năng"
                  type="search"
                  placeholder="Tìm kiếm chức năng…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search.trim() && (
                  <div className="student-search-results">
                    <strong>Chức năng phù hợp</strong>
                    {matches.length ? (
                      matches.map((item) => (
                        <Link
                          key={item.key}
                          href={item.href}
                          onClick={() => setSearch("")}
                        >
                          {item.label} →
                        </Link>
                      ))
                    ) : (
                      <p>Không tìm thấy chức năng trong không gian hiện tại.</p>
                    )}
                  </div>
                )}
              </div>
              <span className="student-topbar-user">
                <span className="avatar">
                  {name.trim().split(" ").at(-1)?.slice(0, 1)}
                </span>
                <strong>{name}</strong>
              </span>
            </>
          }
          <div>{logout}</div>
        </header>
        {
          <div className="student-breadcrumb">
            <Link href={navigation[0]?.href || "/"}>Trang chủ</Link>
            <span aria-hidden="true">›</span>
            <span>{title}</span>
          </div>
        }
        <main id="workspace-content" className="workspace-main">
          <div className="workspace-heading">
            <span className="eyebrow">PHENIKAA · {role.toUpperCase()}</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {children}
        </main>
        <footer className="workspace-footer">
          Trường Công nghệ thông tin · Đại học Phenikaa
          <span>Hệ thống quản lý thực tập tốt nghiệp</span>
        </footer>
      </div>
    </div>
  );
}
