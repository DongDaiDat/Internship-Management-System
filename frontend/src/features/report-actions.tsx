"use client";
import { useState } from "react";
import { api, workspaceHeaders } from "../lib/api";
export function ExportReport({ path, name }: { path: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api${path}`, {
        credentials: "same-origin",
        cache: "no-store",
        headers: workspaceHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Không tải được báo cáo.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không tải được báo cáo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? "Đang xuất…" : "Xuất Excel theo bộ lọc"}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
type Entry = {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
  actor: { fullName: string } | null;
};
const labels: Record<string, string> = {
  "internship.company_change": "Đổi doanh nghiệp",
  "internship.mentor_change": "Đổi giảng viên",
  "weekly_report.unlock": "Mở khóa báo cáo tuần",
  "company.score_on_behalf": "Nhập điểm thay có minh chứng",
};
export function InternshipAudit({ id }: { id: string }) {
  const [items, setItems] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      setItems(await api<Entry[]>(`/reports/internships/${id}/audit`));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Chưa tải được lịch sử.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary
        onClick={() => {
          if (!items && !busy) void load();
        }}
      >
        Lịch sử thay đổi
      </summary>
      {busy && <p role="status">Đang tải…</p>}
      {error && (
        <p role="alert">
          {error} <button onClick={() => void load()}>Thử lại</button>
        </p>
      )}
      {items?.length === 0 && (
        <p>Chưa có thay đổi công ty/giảng viên, mở khóa hoặc điểm nhập thay.</p>
      )}
      {items?.map((item) => (
        <p key={item.id}>
          <strong>{labels[item.action]}</strong>
          <br />
          {new Date(item.createdAt).toLocaleString("vi-VN")} ·{" "}
          {item.actor?.fullName || "Tài khoản không còn"}
          <br />
          {item.reason || "Không ghi lý do"}
        </p>
      ))}
    </details>
  );
}
