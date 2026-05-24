"use client"
import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IoSend } from "react-icons/io5";
import { HiOutlineLightBulb, HiOutlineSparkles } from "react-icons/hi";
import { FiPlus, FiList, FiPaperclip, FiImage, FiCamera, FiFileText, FiEdit, FiDatabase, FiSearch, FiX } from "react-icons/fi";
import { TbGitCompare } from "react-icons/tb";
import {
    getAttachedFiles,
    subscribeAttachedFiles,
    attachFile,
    detachFile,
    clearAttachedFiles,
} from "../../chat/attachedFilesStore";
import { subscribeDraft, getDraft, clearDraft } from "../../chat/chatDraftStore";

import type { AgentStep, ChatSessionState, SourceFile } from "../../chat/chatTypes";
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
import {
    setThaijoReport,
    startThaijoHtmlStream,
    appendThaijoHtmlChunk,
    startThaijoTextStream,
    appendThaijoTextChunk,
    finishThaijoTextStream,
    setThaijoSearchState,
} from "../../chat/thaijoStore";
import type { ThaiJoReportJson } from "../../chat/journal-template/buildJournalHtml";

type ChatInputProps = {
    onToggleDatabaseExplorer?: () => void;
};

type ChatMode = "normal" | "tavily" | "thaijo" | "compare" | "report" | "workplan" | "database";

const _emptySnapshot: never[] = [];
const emptyAttachedFiles = () => _emptySnapshot;

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
    const fileInputRef  = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [uploadingFile, setUploadingFile]   = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const attachedFiles = useSyncExternalStore(
        subscribeAttachedFiles,
        getAttachedFiles,
        emptyAttachedFiles,
    );

    const persistHistory = async (sessionId: string, state: ChatSessionState) => {
        try {
            const response = await fetch("/api/chat/history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId,
                    state,
                }),
            });

            if (response.ok) {
                window.dispatchEvent(new CustomEvent("chat-history-updated", { detail: { sessionId } }));
            }
        } catch (error) {
            console.error("Persist chat history error:", error);
        }
    };

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

    // รับ draft จาก edit button ใน message
    useEffect(() => {
        return subscribeDraft(() => {
            const draft = getDraft();
            if (draft) {
                setMessage(draft);
                clearDraft();
            }
        });
    }, []);

    useEffect(() => {
        const handleNewChat = () => {
            setMessage("");
            setShowAddMenu(false);
            setShowToolsMenu(false);
            setChatMode("normal");
        };

        window.addEventListener("chat-new-session", handleNewChat);
        return () => window.removeEventListener("chat-new-session", handleNewChat);
    }, []);

    const handleSend = async () => {
        const trimmedMessage = message.trim();
        if (!trimmedMessage || isSubmitting) return;

        const currentSessionId = pathname.match(/^\/chat\/sessions\/([^/]+)$/)?.[1];
        const sessionId = currentSessionId ?? generateChatSessionId();
        const currentState = getChatSessionState(sessionId);
        const nextMessages = [
            ...currentState.messages,
            createChatSessionMessage("user", trimmedMessage),
        ];

        const runningState: ChatSessionState = {
            ...currentState,
            sessionId,
            status: "running",
            error: undefined,
            lastUserPrompt: trimmedMessage,
            messages: nextMessages,
        };

        saveChatSessionState(sessionId, runningState);
        void persistHistory(sessionId, runningState);

        setMessage("");
        setShowAddMenu(false);
        setShowToolsMenu(false);

        if (!currentSessionId) router.push(`/chat/sessions/${sessionId}`);
        setIsSubmitting(true);

        try {
            const effectiveMode = attachedFiles.length > 0 && chatMode === "normal" ? "database" : chatMode;
            const apiBody = {
                sessionId,
                prompt: trimmedMessage,
                history: nextMessages,
                mode: effectiveMode,
                attached_files: attachedFiles,
            };
            const response = await fetch("/api/chat", {
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

                    let event: { type: string; [key: string]: unknown };
                    try {
                        event = JSON.parse(line.slice(6)) as { type: string; [key: string]: unknown };
                    } catch { continue; }

                    if (event.type === "text_stream_start") {
                        startThaijoTextStream();
                    } else if (event.type === "text_chunk") {
                        appendThaijoTextChunk((event.text as string) ?? "");
                    } else if (event.type === "crew_plan") {
                        setPlannedAgents(sessionId, event.agents as { name: string; role: string }[]);
                    } else if (event.type === "agent_start") {
                        const current = getStreamingSteps(sessionId) ?? [];
                        const newStep: AgentStep = {
                            step: event.step as string,
                            agentName: event.agentName as string,
                            agentRole: (event.agentRole as string) ?? "",
                            thinking: "",
                            result: "",
                            status: "running",
                        };
                        setStreamingSteps(sessionId, [...current, newStep]);
                        if ((event.step as string) === "generator") startThaijoHtmlStream();
                    } else if (event.type === "agent_done") {
                        const current = getStreamingSteps(sessionId) ?? [];
                        const agentName = event.agentName as string;
                        const result = (event.result as string) ?? "";
                        const code = event.code as string | undefined;
                        setStreamingSteps(sessionId, current.map((s) =>
                            s.agentName === agentName
                                ? { ...s, step: (event.step as string) ?? s.step, result, ...(code ? { code } : {}), status: "done" as const }
                                : s,
                        ));
                    } else if (event.type === "generator_chunk") {
                        const c = (event.html as string) ?? "";
                        thaijoHtmlBufferRef.current += c;
                        appendThaijoHtmlChunk(c);
                    } else if (event.type === "final") {
                        finishThaijoTextStream();
                        // บันทึก search state สำหรับ report generator
                        if (event.textResult) {
                            setThaijoSearchState({
                                query:        (event.reportTitle as string) ?? "",
                                articlesText: (event.articlesText as string) ?? "",
                                articleCount: (event.articleCount as number) ?? 0,
                            });
                        }
                        clearStreamingState(sessionId);
                        const agentSteps = (event.agentSteps as AgentStep[]).map((s) => ({
                            ...s,
                            status: "done" as const,
                        }));

                        let sourceFile: SourceFile | undefined;
                        const finderStep = agentSteps.find((s) => s.step === "file_finder");
                        if (finderStep?.result) {
                            const m = finderStep.result.match(/\[ID:(\d+)\]\s+(.+?\.csv)/i);
                            if (m) sourceFile = { id: m[1], name: m[2].trim() };
                        }

                        const reportHtml = (event.reportHtml as string) || thaijoHtmlBufferRef.current;
                        if (reportHtml) {
                            try {
                                setThaijoReport({
                                    reportJson: { title: (event.reportTitle as string) ?? "Report" } as ThaiJoReportJson,
                                    reportHtml,
                                    sessionId,
                                    articleCount: (event.articleCount as number) ?? 0,
                                });
                            } catch { /* ignore */ }
                            thaijoHtmlBufferRef.current = "";
                        }

                        clearAttachedFiles();
                        const completedState: ChatSessionState = {
                            ...getChatSessionState(sessionId),
                            sessionId,
                            status: "completed",
                            error: undefined,
                            messages: [
                                ...getChatSessionState(sessionId).messages,
                                createChatSessionMessage("ai", event.message as string, agentSteps, sourceFile),
                            ],
                            lastUserPrompt: trimmedMessage,
                        };

                        saveChatSessionState(sessionId, completedState);
                        void persistHistory(sessionId, completedState);
                    } else if (event.type === "error") {
                        throw new Error((event.message as string) || "ระบบ AI ตอบกลับไม่สำเร็จ");
                    }
                }
            }
        } catch (error) {
            clearStreamingState(sessionId);
            const errorMessage = error instanceof Error ? error.message : "ไม่สามารถติดต่อ AI ได้";
            const failedState: ChatSessionState = {
                ...getChatSessionState(sessionId),
                sessionId,
                status: "failed",
                error: errorMessage,
                messages: [
                    ...getChatSessionState(sessionId).messages,
                    createChatSessionMessage("ai", `ระบบ AI ตอบกลับไม่สำเร็จ: ${errorMessage}`),
                ],
            };

            saveChatSessionState(sessionId, failedState);
            void persistHistory(sessionId, failedState);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingFile(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("path", file.name);
            const res = await fetch("/api/files/upload", { method: "POST", body: formData });
            if (!res.ok) throw new Error("Upload failed");
            const stored = await res.json() as { id: string; name: string; extension: string };
            attachFile({ id: stored.id, name: stored.name, extension: stored.extension });
            if (chatMode === "normal") setChatMode("database");
        } catch (err) {
            console.error("File upload error:", err);
        } finally {
            setUploadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const previewUrl = URL.createObjectURL(file);
        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("path", file.name);
            const res = await fetch("/api/files/upload", { method: "POST", body: formData });
            if (!res.ok) throw new Error("Upload failed");
            const stored = await res.json() as { id: string; name: string; extension: string };
            attachFile({ id: stored.id, name: stored.name, extension: stored.extension, previewUrl });
            if (chatMode === "normal") setChatMode("database");
        } catch (err) {
            URL.revokeObjectURL(previewUrl);
            console.error("Image upload error:", err);
        } finally {
            setUploadingImage(false);
            if (imageInputRef.current) imageInputRef.current.value = "";
        }
    };

    return (
        <div ref={wrapperRef} className="w-full max-w-2xl mx-auto bg-white border border-gray-100 p-2.5 rounded-2xl shadow-sm relative">
            {/* Hidden inputs */}
            <input ref={fileInputRef} type="file"
                accept=".pdf,.doc,.docx,.csv,.xlsx,.xls,.txt"
                className="hidden"
                onChange={(e) => { void handleFileSelect(e); }}
            />
            <input ref={imageInputRef} type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { void handleImageSelect(e); }}
            />

            {/* Attached files — card preview */}
            {attachedFiles.length > 0 && (
                <div className="flex items-end gap-2 mb-2 px-1 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
                    {attachedFiles.map((f) => {
                        const ext = f.extension.replace(".", "").toLowerCase();
                        const extColors: Record<string, string> = {
                            pdf: "bg-red-500", doc: "bg-blue-500", docx: "bg-blue-500",
                            csv: "bg-green-500", xlsx: "bg-green-600", xls: "bg-green-600",
                            txt: "bg-gray-400",
                        };
                        const isImage = !!f.previewUrl;
                        return (
                            <div key={f.id} className="relative flex-shrink-0 group">
                                {isImage ? (
                                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                        <img src={f.previewUrl} alt={f.name} className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col items-center justify-center gap-1 px-1.5 pt-2 pb-1.5">
                                        <span className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded ${extColors[ext] ?? "bg-gray-400"}`}>
                                            {ext.toUpperCase() || "FILE"}
                                        </span>
                                        <p className="text-[8px] text-gray-500 text-center leading-tight w-full truncate">
                                            {f.name}
                                        </p>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => detachFile(f.id)}
                                    className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] bg-gray-700 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors shadow-sm"
                                >
                                    <FiX size={9} className="text-white" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Mode pills */}
            {chatMode !== "normal" && (
                <div className="flex items-center flex-wrap gap-1.5 mb-2 px-1">
                    {chatMode === "tavily" && (
                        <div className="flex items-center gap-1.5 bg-[#fff3ee] border border-[#f5c7ad] text-[#c85f35] text-xs font-medium px-2.5 py-1 rounded-full">
                            <FiSearch size={12} /><span>ค้นหาทั่วไป</span>
                            <button type="button" onClick={() => setChatMode("normal")} className="ml-0.5 hover:text-[#eb6f45] transition-colors text-base leading-none">×</button>
                        </div>
                    )}
                    {chatMode === "thaijo" && (
                        <div className="flex items-center gap-1.5 bg-[#eef5ee] border border-[#aad5b8] text-[#1a6b3c] text-xs font-medium px-2.5 py-1 rounded-full">
                            <FiFileText size={12} /><span>วิจัย ThaiJo</span>
                            <button type="button" onClick={() => setChatMode("normal")} className="ml-0.5 hover:text-[#2e9e5b] transition-colors text-base leading-none">×</button>
                        </div>
                    )}
                    {chatMode === "compare" && (
                        <div className="flex items-center gap-1.5 bg-[#eef3ff] border border-[#b3c6f5] text-[#3b5bdb] text-xs font-medium px-2.5 py-1 rounded-full">
                            <TbGitCompare size={12} /><span>เปรียบเทียบข้อมูล</span>
                            <button type="button" onClick={() => setChatMode("normal")} className="ml-0.5 hover:text-[#4c6ef5] transition-colors text-base leading-none">×</button>
                        </div>
                    )}
                    {chatMode === "report" && (
                        <div className="flex items-center gap-1.5 bg-[#fff9db] border border-[#ffe066] text-[#7c6600] text-xs font-medium px-2.5 py-1 rounded-full">
                            <FiFileText size={12} /><span>สรุปรายงาน</span>
                            <button type="button" onClick={() => setChatMode("normal")} className="ml-0.5 hover:text-[#f08c00] transition-colors text-base leading-none">×</button>
                        </div>
                    )}
                    {chatMode === "workplan" && (
                        <div className="flex items-center gap-1.5 bg-[#f3f0ff] border border-[#c5b4f5] text-[#6741d9] text-xs font-medium px-2.5 py-1 rounded-full">
                            <FiEdit size={12} /><span>เขียนแผนงาน</span>
                            <button type="button" onClick={() => setChatMode("normal")} className="ml-0.5 hover:text-[#7c4ad9] transition-colors text-base leading-none">×</button>
                        </div>
                    )}
                    {chatMode === "database" && (
                        <div className="flex items-center gap-1.5 bg-[#fff0f6] border border-[#f5b8d4] text-[#b5295e] text-xs font-medium px-2.5 py-1 rounded-full">
                            <FiDatabase size={12} /><span>ฐานข้อมูล</span>
                            <button type="button" onClick={() => setChatMode("normal")} className="ml-0.5 transition-colors text-base leading-none">×</button>
                        </div>
                    )}
                </div>
            )}

            {/* Popover เพิ่ม */}
            {showAddMenu && (
                <div className="absolute bottom-18 left-2 bg-white rounded-xl shadow-lg border border-gray-100 p-2 w-60 flex flex-col gap-1 z-10">
                    <button
                        onClick={() => { setShowAddMenu(false); fileInputRef.current?.click(); }}
                        disabled={uploadingFile}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-[#334155] hover:bg-gray-50 rounded-lg transition-colors text-left disabled:opacity-50"
                    >
                        {uploadingFile
                            ? <span className="w-[18px] h-[18px] border-2 border-[#db5b24] border-t-transparent rounded-full animate-spin" />
                            : <FiPaperclip size={18} className="text-[#64748b]" />
                        }
                        <span>{uploadingFile ? "กำลังอัปโหลด..." : "เพิ่มไฟล์ (PDF, Word, CSV, Excel)"}</span>
                    </button>
                    <button
                        onClick={() => { setShowAddMenu(false); imageInputRef.current?.click(); }}
                        disabled={uploadingImage}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-[#334155] hover:bg-gray-50 rounded-lg transition-colors text-left disabled:opacity-50"
                    >
                        {uploadingImage
                            ? <span className="w-[18px] h-[18px] border-2 border-[#db5b24] border-t-transparent rounded-full animate-spin" />
                            : <FiImage size={18} className="text-[#64748b]" />
                        }
                        <span>{uploadingImage ? "กำลังอัปโหลด..." : "เพิ่มรูปภาพ"}</span>
                    </button>
                    <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-[#334155] hover:bg-gray-50 rounded-lg transition-colors text-left">
                        <FiCamera size={18} className="text-[#64748b]" />
                        <span>ถ่ายรูป</span>
                    </button>
                    <div className="h-px bg-gray-100 my-1" />
                    <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-[#334155] bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left font-medium">
                        <HiOutlineSparkles size={18} className="text-[#64748b]" />
                        <span>ใช้เครื่องมือ AI</span>
                    </button>
                </div>
            )}

            {/* Popover เครื่องมือ */}
            {showToolsMenu && (
                <div className="absolute bottom-18 left-24 bg-white rounded-xl shadow-lg border border-gray-100 p-2 w-64 flex flex-col gap-1 z-10">
                    <button
                        onClick={() => { setChatMode(chatMode === "compare" ? "normal" : "compare"); setShowToolsMenu(false); }}
                        className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left ${chatMode === "compare" ? "bg-[#eef3ff] text-[#3b5bdb]" : "text-[#334155] hover:bg-gray-50"}`}
                    >
                        <TbGitCompare size={18} className={chatMode === "compare" ? "text-[#4c6ef5]" : "text-[#64748b]"} />
                        <span>เปรียบเทียบข้อมูล</span>
                        {chatMode === "compare" && <span className="ml-auto text-[10px] font-semibold text-[#4c6ef5]">ON</span>}
                    </button>
                    <button
                        onClick={() => { setChatMode(chatMode === "report" ? "normal" : "report"); setShowToolsMenu(false); }}
                        className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left ${chatMode === "report" ? "bg-[#fff9db] text-[#7c6600]" : "text-[#334155] hover:bg-gray-50"}`}
                    >
                        <FiFileText size={18} className={chatMode === "report" ? "text-[#f08c00]" : "text-[#64748b]"} />
                        <span>สรุปรายงาน</span>
                        {chatMode === "report" && <span className="ml-auto text-[10px] font-semibold text-[#f08c00]">ON</span>}
                    </button>
                    <button
                        onClick={() => { setChatMode(chatMode === "workplan" ? "normal" : "workplan"); setShowToolsMenu(false); }}
                        className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left ${chatMode === "workplan" ? "bg-[#f3f0ff] text-[#6741d9]" : "text-[#334155] hover:bg-gray-50"}`}
                    >
                        <FiEdit size={18} className={chatMode === "workplan" ? "text-[#7c4ad9]" : "text-[#64748b]"} />
                        <span>เขียนแผนงาน</span>
                        {chatMode === "workplan" && <span className="ml-auto text-[10px] font-semibold text-[#7c4ad9]">ON</span>}
                    </button>
                    <button
                        onClick={() => {
                            onToggleDatabaseExplorer?.();
                            setChatMode(chatMode === "database" ? "normal" : "database");
                            setShowToolsMenu(false);
                        }}
                        className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left ${chatMode === "database" ? "bg-[#fff0f6] text-[#b5295e]" : "text-[#334155] hover:bg-gray-50"}`}
                    >
                        <FiDatabase size={18} className={chatMode === "database" ? "text-[#c2407a]" : "text-[#64748b]"} />
                        <span>ฐานข้อมูล</span>
                        {chatMode === "database" && <span className="ml-auto text-[10px] font-semibold text-[#c2407a]">ON</span>}
                    </button>
                    <button
                        onClick={() => { setChatMode("tavily"); setShowToolsMenu(false); }}
                        className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left ${chatMode === "tavily" ? "bg-[#fff3ee] text-[#c85f35]" : "text-[#334155] hover:bg-gray-50"}`}
                    >
                        <FiSearch size={18} className={chatMode === "tavily" ? "text-[#eb6f45]" : "text-[#64748b]"} />
                        <span>ค้นหาทั่วไป</span>
                        {chatMode === "tavily" && <span className="ml-auto text-[10px] font-semibold text-[#eb6f45]">ON</span>}
                    </button>
                    <button
                        onClick={() => { setChatMode(chatMode === "thaijo" ? "normal" : "thaijo"); setShowToolsMenu(false); }}
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
                    onKeyDown={(e) => { if (e.key === "Enter") void handleSend(); }}
                    placeholder="พิมพ์ข้อความของคุณ..."
                    className="flex-1 outline-none bg-transparent text-gray-700 placeholder-gray-400 py-1"
                />
                <button
                    onClick={() => { void handleSend(); }}
                    disabled={!message.trim() || isSubmitting}
                    className="bg-[#949eb0] hover:bg-[#7b8599] text-white rounded-lg p-1.5 ml-2 disabled:opacity-50 transition-colors flex items-center justify-center transform hover:scale-105 active:scale-95"
                >
                    <IoSend size={16} className="translate-x-0.5 -translate-y-0.5" />
                </button>
            </div>

            <div className="flex items-center gap-2 mt-2.5 px-1 relative">
                <button
                    onClick={() => { setShowAddMenu(!showAddMenu); setShowToolsMenu(false); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${showAddMenu ? "bg-[#e9ebf0] text-[#334155]" : "bg-[#f4f5f8] hover:bg-[#e9ebf0] text-[#334155]"}`}
                >
                    <FiPlus className="text-[#db5b24]" size={14} />
                    <span>เพิ่ม</span>
                </button>
                <button
                    onClick={() => { setShowToolsMenu(!showToolsMenu); setShowAddMenu(false); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${showToolsMenu ? "bg-[#e9ebf0] text-[#334155]" : "bg-[#f4f5f8] hover:bg-[#e9ebf0] text-[#334155]"}`}
                >
                    <FiList className="text-[#db5b24]" size={14} />
                    <span>เครื่องมือ</span>
                </button>
            </div>
        </div>
    );
};
