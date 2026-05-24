import type { Metadata } from "next";
import "./globals.css";
import { ClientLayout } from "./ClientLayout";

export const metadata: Metadata = {
  title: "AI Analyst — สสส",
  description: "ระบบ AI วิเคราะห์ข้อมูลสุขภาพ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="bg-white text-gray-800">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
