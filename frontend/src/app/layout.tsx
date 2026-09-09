import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quản lý thực tập tốt nghiệp',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
