"use client";
import { useSyncExternalStore, useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { IoCopyOutline, IoPencilOutline, IoRefreshOutline } from "react-icons/io5";

import { createEmptyChatSessionState, getChatSessionState, saveChatSessionState, subscribeToChatSession } from "./chatSessionStore";
import { getStreamingSteps, subscribeToStreamingState } from "./streamingStore";
import { MarkdownContent } from "../component/chat/MarkdownContent";
import { AgentPipelinePanel } from "../component/chat/AgentPipelinePanel";
import { ChatInput } from "../component/chat/ChatInput";
import { setDraft } from "./chatDraftStore";
import { toggleDatabaseExplorer } from "./databaseExplorerStore";
import { getThaijoReport, subscribeToThaijoReport } from "./thaijoStore";
import type { ChatSessionState } from "./chatTypes";

const PREVIEW_SESSION = createEmptyChatSessionState("preview-session");

export const LeftPane = () => {
  const params = useParams<{ sessionId?: string }>();
  const sessionId = typeof params?.sessionId === "string" ? params.sessionId : null;

  const session = useSyncExternalStore(
    (onChange) => subscribeToChatSession(sessionId, onChange),
    () => (sessionId ? getChatSessionState(sessionId) : PREVIEW_SESSION),
    () => PREVIEW_SESSION,
  );

  // Reactive ThaiJo report state — re-renders when HTML finishes
  const thaijoReport = useSyncExternalStore(
    subscribeToThaijoReport,
    getThaijoReport,
    () => null,
  );

  // Live streaming steps
  const liveSteps = useSyncExternalStore(
    (onChange) => subscribeToStreamingState(sessionId, onChange),
    () => (sessionId ? getStreamingSteps(sessionId) : null),
    () => null,
  );

  const isRunning = session.status === "running";
  const hasLivePipeline = isRunning && liveSteps && liveSteps.length > 0;

  const bottomRef = useRef<HTMLDivElement>(null);
  const hydratedSessionsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // Delay before showing "recovery" UI (avoids flash on normal start)
  const [recoveryDelayPassed, setRecoveryDelayPassed] = useState(false);

  // ── Elapsed timer — counts up from session.startedAt ────────────────────
  useEffect(() => {
    if (session.status !== "running") {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setElapsed(0);
      return;
    }
    const startTime = session.startedAt ?? Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session.status, session.startedAt]);

  // ── Recovery delay — wait 3s before showing retry UI ────────────────────
  useEffect(() => {
    if (!isRunning || hasLivePipeline) { setRecoveryDelayPassed(false); return; }
    const t = setTimeout(() => setRecoveryDelayPassed(true), 3000);
    return () => clearTimeout(t);
  }, [isRunning, hasLivePipeline]);

  // ── Poll DB every 5s when in recovery state ──────────────────────────────
  // Backend saves result to DB when pipeline finishes — even if SSE was cut
  useEffect(() => {
    if (!sessionId || !isRunning || hasLivePipeline) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;
        const payload = (await res.json()) as { state?: ChatSessionState | null };
        if (payload.state?.status && payload.state.status !== "running") {
          saveChatSessionState(sessionId, { ...payload.state, sessionId });
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(() => { void poll(); }, 5000);
    return () => clearInterval(interval);
  }, [sessionId, isRunning, hasLivePipeline]);

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const handleCopy = useCallback((id: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  const handleEdit = useCallback((text: string) => {
    setDraft(text);
  }, []);

  const handleRetry = useCallback(() => {
    if (!session.lastUserPrompt) return;
    setDraft(session.lastUserPrompt);
    // Reset to idle so the chat input is ready to send
    if (sessionId) {
      saveChatSessionState(sessionId, {
        ...getChatSessionState(sessionId),
        status: "idle",
        error: undefined,
        startedAt: undefined,
      });
    }
  }, [session.lastUserPrompt, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages.length, liveSteps?.length]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    if (hydratedSessionsRef.current.has(sessionId)) {
      return;
    }

    if (getChatSessionState(sessionId).messages.length > 0) {
      hydratedSessionsRef.current.add(sessionId);
      return;
    }

    hydratedSessionsRef.current.add(sessionId);

    const hydrateFromDatabase = async () => {
      try {
        const res = await fetch(`/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`);
        if (!res.ok) {
          return;
        }

        const payload = (await res.json()) as { state?: ChatSessionState | null };
        if (!payload.state || !payload.state.messages?.length) {
          return;
        }

        saveChatSessionState(sessionId, {
          ...payload.state,
          sessionId,
        });
      } catch (error) {
        console.error("Hydrate chat history error:", error);
      }
    };

    void hydrateFromDatabase();
  }, [sessionId]);

  return (
    <div className="flex-1 h-full border-r border-gray-200 bg-white shrink-0 shadow-sm rounded-lg flex flex-col overflow-hidden">
      <div className="px-4 pt-3.5 pb-3 border-b border-gray-100 shrink-0">
        <h2 className="text-sm font-semibold text-gray-700">Chat</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {session.messages.length === 0 && !hasLivePipeline ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-gray-400">
              {sessionId ? "เริ่มพิมพ์คำถามด้านล่างเพื่อเริ่มสนทนา" : "สร้าง session ใหม่โดยพิมพ์ข้อความในช่องแชตด้านล่าง"}
            </p>
          </div>
        ) : (
          <>
            {session.messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex flex-col items-end group">
                  <div className="bg-[#eb6f45f1] text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-sm shadow-sm leading-relaxed">
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 mr-1">
                    <span className="text-xs text-gray-400">{msg.timestamp}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-100"
                      title="คัดลอก"
                    >
                      <IoCopyOutline size={12} />
                      <span>{copiedId === msg.id ? "คัดลอกแล้ว" : "คัดลอก"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(msg.text)}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#eb6f45] transition-colors px-1.5 py-0.5 rounded hover:bg-[#fff4ef]"
                      title="แก้ไขคำสั่ง"
                    >
                      <IoPencilOutline size={12} />
                      <span>แก้ไข</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex flex-col items-start w-full group">
                  <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[95%] shadow-sm">
                    {/* Agent Pipeline — collapsed toggle */}
                    {msg.agentSteps && msg.agentSteps.length > 0 && (
                      <AgentPipelinePanel steps={msg.agentSteps} isLive={false} />
                    )}
                    {/* Final answer */}
                    <MarkdownContent text={msg.text} />
                    {/* ปุ่มดูผลลัพธ์ ThaiJo */}
                    {msg.agentSteps?.some(s =>
                      s.agentName === "ThaiJo Fetcher" || s.agentName === "Insight Analyst"
                    ) && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {/* ปุ่ม 1: เปิด RightPane */}
                        <button
                          type="button"
                          onClick={() => window.dispatchEvent(new CustomEvent("open-journal-report"))}
                          className="flex items-center gap-1.5 rounded-xl border border-[#aad5b8] bg-[#e8f5ee] px-3 py-1.5 text-xs font-semibold text-[#1a6b3c] transition hover:bg-[#d0edda] hover:border-[#1a6b3c]"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          ดูผลลัพธ์ Journal Report
                        </button>
                        {/* ปุ่ม 2: เปิดหน้า HTML — แสดงเมื่อ AI สร้าง HTML เสร็จแล้วเท่านั้น */}
                        {thaijoReport?.reportHtml && (
                          <button
                            type="button"
                            onClick={() => {
                              const blob = new Blob([thaijoReport.reportHtml], { type: "text/html;charset=utf-8" });
                              window.open(URL.createObjectURL(blob), "_blank");
                            }}
                            className="flex items-center gap-1.5 rounded-xl border border-[#b8d4f5] bg-[#e8f0fe] px-3 py-1.5 text-xs font-semibold text-[#1a56a8] transition hover:bg-[#d0e3fc] hover:border-[#1a56a8]"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            เปิดหน้า HTML
                          </button>
                        )}
                      </div>
                    )}
                    {/* Obsidian notes referenced */}
                    {msg.notesReferenced && msg.notesReferenced.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-[11px] text-gray-400 font-medium mb-1.5">
                          📋 อ้างอิง {msg.notesReferenced.length} notes จากคลังความรู้
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.notesReferenced.map((n) => (
                            <span
                              key={n.note_id}
                              className="inline-flex items-center gap-1 text-[10px] font-medium bg-[#e8f5ee] text-[#1a6b3c] border border-[#aad5b8] px-2 py-0.5 rounded-full"
                            >
                              {n.title || n.note_id}
                              {n.province && (
                                <span className="text-[#2e9e5b] opacity-70">· {n.province}</span>
                              )}
                            </span>
                          ))}
                        </div>
                        {msg.followUps && msg.followUps.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {msg.followUps.map((q, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => { setDraft(q); }}
                                className="text-[10px] bg-[#f0faf3] text-[#1a6b3c] border border-[#c8e6d0] px-2 py-0.5 rounded-full hover:bg-[#d8f0e4] transition-colors text-left"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Source file citation */}
                    {msg.sourceFile && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5 flex-wrap text-[11px] text-gray-400">
                        <span>📂</span>
                        <span className="font-medium text-gray-500">แหล่งข้อมูล:</span>
                        <a
                          href={`/api/files/${msg.sourceFile.id}?download=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`ดาวน์โหลด ${msg.sourceFile.name}`}
                          className="font-mono text-[10px] bg-[#fff4ef] border border-[#eb6f45]/20 px-1.5 py-0.5 rounded text-[#eb6f45] hover:bg-[#eb6f45] hover:text-white transition-colors truncate max-w-[260px] underline-offset-2 hover:underline"
                        >
                          {msg.sourceFile.name}
                        </a>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-400">ID: {msg.sourceFile.id}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 ml-1">
                    <span className="text-xs text-gray-400">{msg.timestamp}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-100"
                      title="คัดลอก"
                    >
                      <IoCopyOutline size={12} />
                      <span>{copiedId === msg.id ? "คัดลอกแล้ว" : "คัดลอก"}</span>
                    </button>
                  </div>
                </div>
              )
            )}

            {/* ── Live streaming bubble (agents running with SSE connected) ── */}
            {hasLivePipeline && (
              <div className="flex flex-col items-start w-full">
                <div className="bg-gray-50 border border-[#eb6f45]/20 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[95%] shadow-sm">
                  <AgentPipelinePanel steps={liveSteps!} isLive={true} elapsedSeconds={elapsed} />
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                    <span>กำลังสรุปผลลัพธ์</span>
                    <span className="font-mono tabular-nums text-[#eb6f45] font-semibold">
                      {formatElapsed(elapsed)}
                    </span>
                    <span className="flex gap-1">
                      {[0, 150, 300].map((d) => (
                        <span
                          key={d}
                          className="w-1 h-1 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: `${d}ms` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Recovery bubble (running but SSE disconnected — e.g. after refresh) ── */}
            {isRunning && !hasLivePipeline && (
              <div className="flex flex-col items-start w-full">
                <div className={`px-4 py-3 rounded-2xl rounded-tl-sm max-w-[95%] shadow-sm border ${
                  recoveryDelayPassed
                    ? "bg-amber-50 border-amber-200"
                    : "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-center gap-2 text-xs mb-1.5">
                    <span className="flex gap-1">
                      {[0, 150, 300].map((d) => (
                        <span
                          key={d}
                          className={`w-1 h-1 rounded-full animate-bounce ${recoveryDelayPassed ? "bg-amber-400" : "bg-gray-400"}`}
                          style={{ animationDelay: `${d}ms` }}
                        />
                      ))}
                    </span>
                    <span className={recoveryDelayPassed ? "text-amber-700" : "text-gray-500"}>
                      {recoveryDelayPassed ? "กำลังประมวลผล..." : "กำลังเริ่มต้น..."}
                    </span>
                    {elapsed > 0 && (
                      <span className="font-mono tabular-nums text-[#eb6f45] font-semibold">
                        {formatElapsed(elapsed)}
                      </span>
                    )}
                  </div>
                  {recoveryDelayPassed && (
                    <p className="text-[11px] text-amber-600 leading-relaxed">
                      ระบบ AI กำลังวิเคราะห์อยู่ — การเชื่อมต่อถูกตัดชั่วคราว (เช่น refresh)
                      ระบบจะโหลดผลลัพธ์โดยอัตโนมัติเมื่อพร้อม
                    </p>
                  )}
                  {recoveryDelayPassed && session.lastUserPrompt && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 hover:text-amber-900 transition-colors"
                    >
                      <IoRefreshOutline size={12} />
                      ส่งคำถามใหม่อีกครั้ง
                    </button>
                  )}
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

      <div className="shrink-0 p-3 border-t border-gray-100">
        <ChatInput onToggleDatabaseExplorer={toggleDatabaseExplorer} />
      </div>
    </div>
  );
};
