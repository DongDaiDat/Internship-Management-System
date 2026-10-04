import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";
import "./student-workspace.css";
import "./desktop-workspace.css";

export const metadata: Metadata = {
  title: "Quản lý thực tập tốt nghiệp",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
