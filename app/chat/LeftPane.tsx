"use client";
import { useSyncExternalStore, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { HiOutlineSparkles } from "react-icons/hi";

import type { ChatSessionState } from "./chatTypes";
import { createEmptyChatSessionState, getChatSessionState, subscribeToChatSession } from "./chatSessionStore";
import { getStreamingSteps, getPlannedAgents, subscribeToStreamingState } from "./streamingStore";
import { MarkdownContent } from "../component/chat/MarkdownContent";
import { LiveAgentPipeline } from "../component/agent/LiveAgentPipeline";
import { DoneAgentPipeline } from "../component/agent/DoneAgentPipeline";

const PREVIEW_SESSION: ChatSessionState = createEmptyChatSessionState("preview-session");

export const LeftPane = () => {
  const params = useParams<{ sessionId?: string }>();
  const sessionId = typeof params?.sessionId === "string" ? params.sessionId : null;

  const session = useSyncExternalStore(
    (onChange) => subscribeToChatSession(sessionId, onChange),
    () => (sessionId ? getChatSessionState(sessionId) : PREVIEW_SESSION),
    () => PREVIEW_SESSION,
  );

  const streamingSteps = useSyncExternalStore(
    (onChange) => subscribeToStreamingState(sessionId, onChange),
    () => (sessionId ? getStreamingSteps(sessionId) : null),
    () => null,
  );

  const plannedAgents = useSyncExternalStore(
    (onChange) => subscribeToStreamingState(sessionId, onChange),
    () => (sessionId ? getPlannedAgents(sessionId) : null),
    () => null,
  );

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages.length, streamingSteps?.length]);

  return (
    <div className="flex-1 h-full border-r border-gray-200 bg-white shrink-0 shadow-sm rounded-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <h2 className="text-sm font-semibold text-gray-700">Multi-Agent Chat</h2>
          {sessionId && (
            <span className={clsx(
              "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              session.status === "completed" && "bg-emerald-50 text-emerald-600",
              session.status === "running"   && "bg-amber-50 text-amber-600",
              session.status === "failed"    && "bg-rose-50 text-rose-600",
              session.status === "idle"      && "bg-slate-100 text-slate-500",
            )}>
              {session.status}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {session.messages.length === 0 && !streamingSteps ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center py-8">
              <div className="flex justify-center gap-2 mb-3">
                {(["O", "R", "S"] as const).map((letter, i) => (
                  <div key={letter} className={clsx(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold",
                    i === 0 && "bg-violet-100 text-violet-600",
                    i === 1 && "bg-blue-100 text-blue-600",
                    i === 2 && "bg-emerald-100 text-emerald-600",
                  )}>
                    {letter}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500">
                {sessionId
                  ? "เริ่มพิมพ์คำถามด้านล่างเพื่อเริ่มสนทนา"
                  : "สร้าง session ใหม่โดยพิมพ์ข้อความในช่องแชตด้านล่าง"}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Orchestrator · Research Agent · Synthesizer</p>
            </div>
          </div>
        ) : (
          <>
            {session.messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex flex-col items-end">
                  <div className="bg-[#eb6f45f1] text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-sm shadow-sm leading-relaxed">
                    {msg.text}
                  </div>
                  <span className="text-xs text-gray-400 mt-1 mr-1">{msg.timestamp}</span>
                </div>
              ) : (
                <div key={msg.id} className="flex flex-col items-start w-full">
                  {msg.agentSteps && msg.agentSteps.length > 0 && (
                    <div className="w-full max-w-[95%]">
                      <DoneAgentPipeline steps={msg.agentSteps} messageId={msg.id} />
                    </div>
                  )}
                  <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[95%] shadow-sm">
                    {msg.agentSteps && msg.agentSteps.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-gray-100">
                        <HiOutlineSparkles size={11} className="text-emerald-500" />
                        <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">
                          Final Answer
                        </span>
                      </div>
                    )}
                    <MarkdownContent text={msg.text} />
                  </div>
                  <span className="text-xs text-gray-400 mt-1 ml-1">{msg.timestamp}</span>
                </div>
              ),
            )}

            {session.status === "running" && streamingSteps !== null && (
              <div className="flex flex-col items-start w-full">
                <div className="w-full max-w-[95%]">
                  <LiveAgentPipeline streamingSteps={streamingSteps} plannedAgents={plannedAgents} />
                </div>
              </div>
            )}
          </>
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
