
'use client';

import { useState } from "react";
import { usePathname } from "next/navigation";

import { Sidebar } from "./component/Sidebar";
import { ChatInput } from "./component/chat/ChatInput";
import "./globals.css";



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [showDatabaseExplorer, setShowDatabaseExplorer] = useState(false);
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot-password");
  const shouldShowChatInput = !pathname.startsWith("/fileapa") && !isAuthPage;
  const shouldShowDatabasePanel = showDatabaseExplorer || pathname.startsWith("/fileapa");

  return (
    <html
    >
      <body className="bg-white text-gray-800">
        {isAuthPage ? (
          <main className="min-h-screen w-full">
            {children}
          </main>
        ) : (
          <div className="flex h-screen overflow-hidden">
            <Sidebar showDatabaseExplorer={shouldShowDatabasePanel} />
            <main className="flex flex-col flex-1 h-full w-full relative">
              {/* พื้นที่สำหรับแสดงข้อความแชท */}
              <div className="flex-1 overflow-y-auto">
                {children}
              </div>
              
              {/* พื้นที่สำหรับกล่องพิมพ์ข้อความวางอยู่ด้านล่าง */}
              {shouldShowChatInput ? (
                <div className="w-full bg-linear-to-t from-white via-white to-transparent p-4 pb-8 md:p-6 lg:px-24">
                  <ChatInput onToggleDatabaseExplorer={() => setShowDatabaseExplorer((current) => !current)} />
                </div>
              ) : null}
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
