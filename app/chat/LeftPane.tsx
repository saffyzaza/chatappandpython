"use client";
import { useSyncExternalStore, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

import { createEmptyChatSessionState, getChatSessionState, subscribeToChatSession } from "./chatSessionStore";
import { MarkdownContent } from "../component/chat/MarkdownContent";

const PREVIEW_SESSION = createEmptyChatSessionState("preview-session");

export const LeftPane = () => {
  const params = useParams<{ sessionId?: string }>();
  const sessionId = typeof params?.sessionId === "string" ? params.sessionId : null;

  const session = useSyncExternalStore(
    (onChange) => subscribeToChatSession(sessionId, onChange),
    () => (sessionId ? getChatSessionState(sessionId) : PREVIEW_SESSION),
    () => PREVIEW_SESSION,
  );

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages.length]);

  return (
    <div className="flex-1 h-full border-r border-gray-200 bg-white shrink-0 shadow-sm rounded-lg flex flex-col overflow-hidden">
      <div className="px-4 pt-3.5 pb-3 border-b border-gray-100 shrink-0">
        <h2 className="text-sm font-semibold text-gray-700">Chat</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {session.messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-gray-400">
              {sessionId ? "เริ่มพิมพ์คำถามด้านล่างเพื่อเริ่มสนทนา" : "สร้าง session ใหม่โดยพิมพ์ข้อความในช่องแชตด้านล่าง"}
            </p>
          </div>
        ) : (
          session.messages.map((msg) =>
            msg.role === "user" ? (
              <div key={msg.id} className="flex flex-col items-end">
                <div className="bg-[#eb6f45f1] text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-sm shadow-sm leading-relaxed">
                  {msg.text}
                </div>
                <span className="text-xs text-gray-400 mt-1 mr-1">{msg.timestamp}</span>
              </div>
            ) : (
              <div key={msg.id} className="flex flex-col items-start w-full">
                <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[95%] shadow-sm">
                  <MarkdownContent text={msg.text} />
                </div>
                <span className="text-xs text-gray-400 mt-1 ml-1">{msg.timestamp}</span>
              </div>
            )
          )
        )}

        {session.error && (
          <div className="rounded-2xl bg-[#fff4f2] p-3 text-sm text-[#a04222] ring-1 ring-[#f0dfd8]">
            {session.error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};
