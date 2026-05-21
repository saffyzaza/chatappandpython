"use client"
import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IoSend } from "react-icons/io5";
import { HiOutlineLightBulb, HiOutlineSparkles } from "react-icons/hi";
import { FiPlus, FiList, FiPaperclip, FiImage, FiCamera, FiFileText, FiEdit, FiDatabase, FiSearch } from "react-icons/fi";
import { TbGitCompare } from "react-icons/tb";

import type { AgentStep, SourceFile } from "../../chat/chatTypes";
import {
    createChatSessionMessage,
    generateChatSessionId,
    getChatSessionState,
    saveChatSessionState,
} from "../../chat/chatSessionStore";
import {
    setStreamingSteps,
    setPlannedAgents,
    clearStreamingState,
    getStreamingSteps,
} from "../../chat/streamingStore";
import { setThaijoReport, startThaijoHtmlStream, appendThaijoHtmlChunk } from "../../chat/thaijoStore";
import type { ThaiJoReportJson } from "../../chat/journal-template/buildJournalHtml";

type ChatInputProps = {
    onToggleDatabaseExplorer?: () => void;
};

type ChatMode = "normal" | "tavily" | "thaijo";

export const ChatInput = ({ onToggleDatabaseExplorer }: ChatInputProps) => {
    const router = useRouter();
    const thaijoHtmlBufferRef = useRef("");
    const pathname = usePathname();
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showToolsMenu, setShowToolsMenu] = useState(false);
    const [chatMode, setChatMode] = useState<ChatMode>("normal");
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowAddMenu(false);
                setShowToolsMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSend = async () => {
        const trimmedMessage = message.trim();

        if (!trimmedMessage || isSubmitting) {
            return;
        }

        const currentSessionId = pathname.match(/^\/chat\/sessions\/([^/]+)$/)?.[1];
        const sessionId = currentSessionId ?? generateChatSessionId();
        const currentState = getChatSessionState(sessionId);
        const nextMessages = [
            ...currentState.messages,
            createChatSessionMessage("user", trimmedMessage),
        ];

        saveChatSessionState(sessionId, {
            ...currentState,
            sessionId,
            status: "running",
            error: undefined,
            lastUserPrompt: trimmedMessage,
            messages: nextMessages,
        });

        setMessage("");
        setShowAddMenu(false);
        setShowToolsMenu(false);

        if (!currentSessionId) {
            router.push(`/chat/sessions/${sessionId}`);
        }

        setIsSubmitting(true);

        try {
            const apiUrl = "/api/chat";
            const apiBody = { sessionId, prompt: trimmedMessage, history: nextMessages, mode: chatMode };
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(apiBody),
            });

            if (!response.ok || !response.body) {
                let errorMsg = "ไม่สามารถติดต่อ AI ได้";
                try {
                    const errPayload = (await response.json()) as { error?: string };
                    if (errPayload.error) errorMsg = errPayload.error;
                } catch { /* ignore */ }
                throw new Error(errorMsg);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop() ?? "";

                for (const part of parts) {
                    const line = part.trim();
                    if (!line.startsWith("data: ")) continue;

                    let event: { type: string;[key: string]: unknown };
                    try {
                        event = JSON.parse(line.slice(6)) as { type: string;[key: string]: unknown };
                    } catch {
                        continue;
                    }

                    if (event.type === "crew_plan") {
                        setPlannedAgents(sessionId, event.agents as { name: string; role: string }[]);
                    } else if (event.type === "agent_start") {
                        const current = getStreamingSteps(sessionId) ?? [];
                        const newStep: AgentStep = {
                            step: event.step as string,
                            agentName: event.agentName as string,
                            agentRole: event.agentRole as string ?? "",
                            thinking: "",
                            result: "",
                            status: "running",
                        };
                        setStreamingSteps(sessionId, [...current, newStep]);
                        if ((event.step as string) === "generator") startThaijoHtmlStream();
                    } else if (event.type === "agent_done") {
                        const current = getStreamingSteps(sessionId) ?? [];
                        const agentName = event.agentName as string;
                        const result = event.result as string ?? "";
                        const code = event.code as string | undefined;
                        setStreamingSteps(sessionId, current.map((s) =>
                            s.agentName === agentName
                                ? { ...s, step: event.step as string ?? s.step, result, ...(code ? { code } : {}), status: "done" as const }
                                : s,
                        ));
                    } else if (event.type === "generator_chunk") {
                        const c = event.html as string ?? "";
                        thaijoHtmlBufferRef.current += c;
                        appendThaijoHtmlChunk(c);
                    } else if (event.type === "final") {
                        clearStreamingState(sessionId);
                        const agentSteps = (event.agentSteps as AgentStep[]).map((s) => ({
                            ...s,
                            status: "done" as const,
                        }));

                        // Extract source file from file_finder step result e.g. "[ID:843201] filename.csv"
                        let sourceFile: SourceFile | undefined;
                        const finderStep = agentSteps.find((s) => s.step === "file_finder");
                        if (finderStep?.result) {
                            const m = finderStep.result.match(/\[ID:(\d+)\]\s+(.+?\.csv)/i);
                            if (m) sourceFile = { id: m[1], name: m[2].trim() };
                        }

                        // ThaiJo: use streamed HTML → update RightPane
                        const reportHtml = (event.reportHtml as string) || thaijoHtmlBufferRef.current;
                        if (reportHtml) {
                            try {
                                setThaijoReport({
                                    reportJson: { title: event.reportTitle as string ?? "Journal Report" } as ThaiJoReportJson,
                                    reportHtml,
                                    sessionId,
                                    articleCount: (event.articleCount as number) ?? 0,
                                });
                            } catch { /* ignore */ }
                            thaijoHtmlBufferRef.current = "";
                        }

                        saveChatSessionState(sessionId, {
                            ...getChatSessionState(sessionId),
                            sessionId,
                            status: "completed",
                            error: undefined,
                            messages: [
                                ...getChatSessionState(sessionId).messages,
                                createChatSessionMessage("ai", event.message as string, agentSteps, sourceFile),
                            ],
                            lastUserPrompt: trimmedMessage,
                        });
                    } else if (event.type === "error") {
                        throw new Error((event.message as string) || "ระบบ AI ตอบกลับไม่สำเร็จ");
                    }
                }
            }
        } catch (error) {
            clearStreamingState(sessionId);
            const errorMessage = error instanceof Error ? error.message : "ไม่สามารถติดต่อ AI ได้";

            saveChatSessionState(sessionId, {
                ...getChatSessionState(sessionId),
                sessionId,
                status: "failed",
                error: errorMessage,
                messages: [
                    ...getChatSessionState(sessionId).messages,
                    createChatSessionMessage("ai", `ระบบ AI ตอบกลับไม่สำเร็จ: ${errorMessage}`),
                ],
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div ref={wrapperRef} className="w-full max-w-2xl mx-auto bg-white border border-gray-100 p-2.5 rounded-2xl shadow-sm relative">
            {/* Mode pill */}
            {chatMode !== "normal" && (
                <div className="flex items-center gap-1.5 mb-2 px-1">
                    {chatMode === "tavily" && (
                        <div className="flex items-center gap-1.5 bg-[#fff3ee] border border-[#f5c7ad] text-[#c85f35] text-xs font-medium px-2.5 py-1 rounded-full">
                            <FiSearch size={12} />
                            <span>ค้นหาทั่วไป</span>
                            <button type="button" onClick={() => setChatMode("normal")}
                                className="ml-0.5 hover:text-[#eb6f45] transition-colors text-base leading-none">×</button>
                        </div>
                    )}
                    {chatMode === "thaijo" && (
                        <div className="flex items-center gap-1.5 bg-[#eef5ee] border border-[#aad5b8] text-[#1a6b3c] text-xs font-medium px-2.5 py-1 rounded-full">
                            <FiFileText size={12} />
                            <span>วิจัย ThaiJo</span>
                            <button type="button" onClick={() => setChatMode("normal")}
                                className="ml-0.5 hover:text-[#2e9e5b] transition-colors text-base leading-none">×</button>
                        </div>
                    )}
                </div>
            )}
            {/* Popover เพิ่ม */}
            {showAddMenu && (
                <div className="absolute bottom-18 left-2 bg-white rounded-xl shadow-lg border border-gray-100 p-2 w-56 flex flex-col gap-1 z-10 transition-all">
                    <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-[#334155] hover:bg-gray-50 rounded-lg transition-colors text-left">
                        <FiPaperclip size={18} className="text-[#64748b]" />
                        <span>เพิ่มไฟล์</span>
                    </button>
                    <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-[#334155] hover:bg-gray-50 rounded-lg transition-colors text-left">
                        <FiImage size={18} className="text-[#64748b]" />
                        <span>เพิ่มรูปภาพ</span>
                    </button>
                    <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-[#334155] hover:bg-gray-50 rounded-lg transition-colors text-left">
                        <FiCamera size={18} className="text-[#64748b]" />
                        <span>ถ่ายรูป</span>
                    </button>
                    <div className="h-px bg-gray-100 my-1"></div>
                    <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-[#334155] bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left font-medium">
                        <HiOutlineSparkles size={18} className="text-[#64748b]" />
                        <span>ใช้เครื่องมือ AI</span>
                    </button>
                </div>
            )}

            {/* Popover เครื่องมือ */}
            {showToolsMenu && (
                <div className="absolute bottom-18 left-24 bg-white rounded-xl shadow-lg border border-gray-100 p-2 w-64 flex flex-col gap-1 z-10 transition-all">
                    <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-[#334155] hover:bg-gray-50 rounded-lg transition-colors text-left">
                        <TbGitCompare size={18} className="text-[#64748b]" />
                        <span>เปรียบเทียบข้อมูล</span>
                    </button>
                    <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-[#334155] hover:bg-gray-50 rounded-lg transition-colors text-left">
                        <FiFileText size={18} className="text-[#64748b]" />
                        <span>สรุปรายงาน</span>
                    </button>
                    <div className="flex flex-col w-full text-left">
                        <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-[#334155] hover:bg-gray-50 rounded-lg transition-colors">
                            <FiEdit size={18} className="text-[#64748b]" />
                            <span>เขียนแผนงาน</span>
                        </button>
                        <div className="pl-10 pb-2 pr-3 flex flex-col gap-2 relative">
                            <div className="absolute left-5.25 top-0 bottom-2 w-px bg-gray-200"></div>
                            <div className="text-xs text-[#64748b] bg-white relative z-10">A = บทความต้นฉบับ</div>
                            <div className="text-xs text-[#64748b] bg-white relative z-10 leading-relaxed">B = แนวทางการเฝ้าระวัง<br />สอบสวน ควบคุมโรค</div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            onToggleDatabaseExplorer?.();
                            setShowToolsMenu(false);
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-[#334155] hover:bg-gray-50 rounded-lg transition-colors text-left"
                    >
                        <FiDatabase size={18} className="text-[#64748b]" />
                        <span>ฐานข้อมูล</span>
                    </button>

                    <button
                        onClick={() => {
                            setChatMode("tavily");
                            setShowToolsMenu(false);
                        }}
                        className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left ${chatMode === "tavily" ? "bg-[#fff3ee] text-[#c85f35]" : "text-[#334155] hover:bg-gray-50"}`}
                    >
                        <FiSearch size={18} className={chatMode === "tavily" ? "text-[#eb6f45]" : "text-[#64748b]"} />
                        <span>ค้นหาทั่วไป</span>
                        {chatMode === "tavily" && <span className="ml-auto text-[10px] font-semibold text-[#eb6f45]">ON</span>}
                    </button>
                    <button
                        onClick={() => {
                            setChatMode(chatMode === "thaijo" ? "normal" : "thaijo");
                            setShowToolsMenu(false);
                        }}
                        className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left ${chatMode === "thaijo" ? "bg-[#eef5ee] text-[#1a6b3c]" : "text-[#334155] hover:bg-gray-50"}`}
                    >
                        <FiFileText size={18} className={chatMode === "thaijo" ? "text-[#2e9e5b]" : "text-[#64748b]"} />
                        <span>วิจัย ThaiJo</span>
                        {chatMode === "thaijo" && <span className="ml-auto text-[10px] font-semibold text-[#2e9e5b]">ON</span>}
                    </button>
                </div>
            )}

            <div className="flex items-center w-full bg-[#f8f9fb] border border-gray-200 rounded-xl px-3 py-1.5 transition-all focus-within:border-gray-300 focus-within:bg-white text-sm">
                <HiOutlineLightBulb size={18} className="text-[#db5b24] mr-2.5" />
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            void handleSend();
                        }
                    }}
                    placeholder="พิมพ์ข้อความของคุณ..."
                    className="flex-1 outline-none bg-transparent text-gray-700 placeholder-gray-400 py-1"
                />
                <button
                    onClick={() => {
                        void handleSend();
                    }}
                    disabled={!message.trim() || isSubmitting}
                    className="bg-[#949eb0] hover:bg-[#7b8599] text-white rounded-lg p-1.5 ml-2 disabled:opacity-50 transition-colors flex items-center justify-center transform hover:scale-105 active:scale-95"
                    title="Send message"
                >
                    <IoSend size={16} className="translate-x-0.5 -translate-y-0.5" />
                </button>
            </div>

            <div className="flex items-center gap-2 mt-2.5 px-1 relative">
                <button
                    onClick={() => {
                        setShowAddMenu(!showAddMenu);
                        setShowToolsMenu(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${showAddMenu ? 'bg-[#e9ebf0] text-[#334155]' : 'bg-[#f4f5f8] hover:bg-[#e9ebf0] text-[#334155]'}`}
                >
                    <FiPlus className="text-[#db5b24]" size={14} />
                    <span>เพิ่ม</span>
                </button>
                <button
                    onClick={() => {
                        setShowToolsMenu(!showToolsMenu);
                        setShowAddMenu(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${showToolsMenu ? 'bg-[#e9ebf0] text-[#334155]' : 'bg-[#f4f5f8] hover:bg-[#e9ebf0] text-[#334155]'}`}
                >
                    <FiList className="text-[#db5b24]" size={14} />
                    <span>เครื่องมือ</span>
                </button>

            </div>
        </div>
    );
};
