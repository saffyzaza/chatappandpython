"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./component/Sidebar";
import { ChatInput } from "./component/chat/ChatInput";
import {
  getDatabaseExplorerOpen,
  subscribeDatabaseExplorer,
  toggleDatabaseExplorer,
} from "./chat/databaseExplorerStore";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showDatabaseExplorer = useSyncExternalStore(
    subscribeDatabaseExplorer,
    getDatabaseExplorerOpen,
    () => false,
  );

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password");

  const isFullScreenTool = pathname.startsWith("/musyaend");

  const shouldShowChatInput =
    !pathname.startsWith("/fileapa") &&
    !pathname.startsWith("/pdf-upload") &&
    !pathname.startsWith("/chat") &&
    !pathname.startsWith("/account") &&
    !pathname.startsWith("/approved") &&
    !isAuthPage;

  const shouldShowDatabasePanel =
    showDatabaseExplorer || pathname.startsWith("/fileapa");

  if (isAuthPage || isFullScreenTool) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar showDatabaseExplorer={shouldShowDatabasePanel} />
      <main className="flex flex-col flex-1 h-full w-full relative">
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        {shouldShowChatInput ? (
          <div className="w-full bg-linear-to-t from-white via-white to-transparent p-4 pb-8 md:p-6 lg:px-24">
            <ChatInput
              onToggleDatabaseExplorer={toggleDatabaseExplorer}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
