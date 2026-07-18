"use client"
import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IoSend, IoStop } from "react-icons/io5";
import { HiOutlineLightBulb, HiOutlineSparkles } from "react-icons/hi";
import {
    FiPlus, FiList, FiPaperclip, FiImage, FiCamera,
    FiDatabase, FiSearch, FiX, FiActivity, FiBookOpen, FiBook, FiClipboard,
} from "react-icons/fi";
import {
    getAttachedFiles,
    subscribeAttachedFiles,
    attachFile,
    detachFile,
    clearAttachedFiles,
} from "../../chat/attachedFilesStore";
import { subscribeDraft, getDraft, clearDraft } from "../../chat/chatDraftStore";

import type { AgentStep, ChatSessionState, SourceFile, ObsidianNoteRef } from "../../chat/chatTypes";
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

// ── Tool definitions ───────────────────────────────────────────────────────────
const TOOL_DEFS = [
    {
        id: "report",
        labelTh: "สร้างรายงาน",
        desc: "สร้างรายงานสรุปจากข้อมูลที่รวบรวม แสดงผลด้านขวา",
        bgColor: "#fff9db", borderColor: "#ffe066", textColor: "#7c6600",
        activeIconColor: "#f08c00",
        Icon: FiClipboard,
    },
    {
        id: "stats",
        labelTh: "สถิติ",
        desc: "วิเคราะห์ข้อมูลสถิติสาธารณสุข และอุบัติเหตุทางถนน (Accident SQL Agent)",
        bgColor: "#f3f0ff", borderColor: "#c5b4f5", textColor: "#6741d9",
        activeIconColor: "#7c4ad9",
        Icon: FiActivity,
    },
    {
        id: "tavily",
        labelTh: "ค้นหาทั่วไป",
        desc: "ค้นหาข้อมูลจากอินเทอร์เน็ตด้วย Tavily Search",
        bgColor: "#fff3ee", borderColor: "#f5c7ad", textColor: "#c85f35",
        activeIconColor: "#eb6f45",
        Icon: FiSearch,
    },
    {
        id: "thaijo",
        labelTh: "วิจัย",
        desc: "ค้นหาและสังเคราะห์บทความวิจัยจากฐานข้อมูล ThaiJo",
        bgColor: "#eef5ee", borderColor: "#aad5b8", textColor: "#1a6b3c",
        activeIconColor: "#2e9e5b",
        Icon: FiBookOpen,
    },
    {
        id: "obsidian",
        labelTh: "คลังความรู้รายงาน",
        desc: "คลังความรู้สุขภาพ เขตสุขภาพที่ 10 (อุบล ศรีสะเกษ ยโสธร ฯ)",
        bgColor: "#f0fdfa", borderColor: "#99f6e4", textColor: "#0f766e",
        activeIconColor: "#0d9488",
        Icon: FiBook,
    },
    {
        id: "pubmed",
        labelTh: "ค้นหา PubMed",
        desc: "ค้นหางานวิจัยทางการแพทย์จาก PubMed (เฉพาะบทความ Free Full Text)",
        bgColor: "#eff6ff", borderColor: "#93c5fd", textColor: "#1d4ed8",
        activeIconColor: "#2563eb",
        Icon: FiDatabase,
    },
] as const;

type ToolId = typeof TOOL_DEFS[number]["id"];

const TOOL_MODE_MAP: Record<ToolId, string> = {
    stats:           "stats",
    report:          "report",
    tavily:          "tavily",
    thaijo:          "thaijo",
    obsidian:        "obsidian",
    pubmed:          "pubmed",
};

// เครื่องมือที่ "สร้างรายงาน" จะดึงข้อมูลอัตโนมัติ
const REPORT_DATA_SOURCES: ToolId[] = ["stats", "obsidian", "thaijo", "tavily", "pubmed"];

const DATA_LABELS: Partial<Record<ToolId, string>> = {
    thaijo:   "บทความวิจัย",
    obsidian: "คลังความรู้",
    stats:    "สถิติ",
    tavily:   "ค้นหา",
    pubmed:   "PubMed",
};

const _emptySnapshot: never[] = [];
const emptyAttachedFiles = () => _emptySnapshot;

const MAX_TEXTAREA_HEIGHT = 160; // px — เกินนี้ให้ scroll แทนการขยายต่อ

export const ChatInput = ({ onToggleDatabaseExplorer }: ChatInputProps) => {
    const router = useRouter();
    const thaijoHtmlBufferRef = useRef("");
    const pathname = usePathname();
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showToolsMenu, setShowToolsMenu] = useState(false);
    const [selectedTools, setSelectedTools] = useState<ToolId[]>([]);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const fileInputRef  = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const textareaRef   = useRef<HTMLTextAreaElement>(null);
    // true เมื่อหน้ากำลัง refresh/ปิด — ใช้กันไม่ให้เขียน "failed" ทับ state "running"
    const isUnloadingRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [uploadingFile, setUploadingFile]   = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const attachedFiles = useSyncExternalStore(
        subscribeAttachedFiles,
        getAttachedFiles,
        emptyAttachedFiles,
    );

    const toggleTool = (id: ToolId) => {
        setSelectedTools(prev =>
            prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        );
    };

    const removeTool = (id: ToolId) => {
        setSelectedTools(prev => prev.filter(t => t !== id));
    };

    /** Compute the API mode from selected tools */
    const getEffectiveMode = (tools: ToolId[], hasFiles: boolean): string => {
        // Files attached → force database mode
        if (hasFiles) return "database";
        if (tools.length === 0) return "normal";
        // report → รวบรวมจาก 3 แหล่ง (thaijo + obsidian + stats) แล้วเปิด wizard
        if (tools.includes("report")) return "report-gather";
        const nonReport = tools.filter(t => t !== "report");
        if (nonReport.length === 1) return TOOL_MODE_MAP[nonReport[0]] ?? "thaijo";
        return "multi";
    };

    const persistHistory = async (sessionId: string, state: ChatSessionState) => {
        try {
            const response = await fetch("/api/chat/history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, state }),
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

    // ขยายช่อง input ตามเนื้อหา — สูงสุด MAX_TEXTAREA_HEIGHT แล้ว scroll แทน
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    }, [message]);

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

    // ตั้ง flag เมื่อหน้ากำลังถูก refresh/ปิด — beforeunload จะยิงก่อน fetch ถูก abort
    useEffect(() => {
        const markUnloading = () => { isUnloadingRef.current = true; };
        window.addEventListener("beforeunload", markUnloading);
        window.addEventListener("pagehide", markUnloading);
        return () => {
            window.removeEventListener("beforeunload", markUnloading);
            window.removeEventListener("pagehide", markUnloading);
        };
    }, []);

    useEffect(() => {
        const handleNewChat = () => {
            setMessage("");
            setShowAddMenu(false);
            setShowToolsMenu(false);
            setSelectedTools([]);
        };
        window.addEventListener("chat-new-session", handleNewChat);
        return () => window.removeEventListener("chat-new-session", handleNewChat);
    }, []);

    const handleSend = async () => {
        const trimmedMessage = message.trim();
        if (!trimmedMessage || isSubmitting) return;

        const currentSelectedTools = [...selectedTools]; // capture at send time

        // เมื่อ "สร้างรายงาน" ถูกเลือก → อัตโนมัติดึงข้อมูลจาก 3 แหล่ง (สถิติ + คลังความรู้ + วิจัย)
        const effectiveTools: ToolId[] = currentSelectedTools.includes("report")
            ? [...new Set([...currentSelectedTools, ...REPORT_DATA_SOURCES])]
            : currentSelectedTools;

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
            startedAt: Date.now(),
        };

        saveChatSessionState(sessionId, runningState);
        void persistHistory(sessionId, runningState);

        setMessage("");
        setShowAddMenu(false);
        setShowToolsMenu(false);

        if (!currentSessionId) router.push(`/chat/sessions/${sessionId}`);
        setIsSubmitting(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const effectiveMode = getEffectiveMode(effectiveTools, attachedFiles.length > 0);
            // โหมด "สร้างรายงาน" — ผู้ใช้ต้องการเห็นเนื้อหาเต็มที่ช่องซ้าย (แชท) เท่านั้น
            // ไม่สตรีมไปช่องขวา ("ข้อมูลพื้นฐาน") อีก
            const isReportMode = effectiveMode === "report-gather";

            const apiBody = {
                sessionId,
                prompt: trimmedMessage,
                history: nextMessages,
                mode: effectiveMode,
                tools: effectiveTools,
                attached_files: attachedFiles,
            };
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(apiBody),
                signal: controller.signal,
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
                        if (isReportMode) {
                            // report-gather → สตรีม "ข้อมูลพื้นฐาน" ไปช่องขวา + เปิด wizard
                            // ให้ผู้ใช้กดสร้างรายงานฉบับจริงต่อจากข้อมูลที่รวบรวมมา
                            startThaijoTextStream(true, "ข้อมูลพื้นฐาน");
                        } else {
                            const dataTools = effectiveTools.filter(t => t !== "report");
                            const _toolLabel = dataTools.length > 0
                                ? dataTools.map(t => DATA_LABELS[t] ?? t).join(" + ")
                                : "ผลลัพธ์";
                            startThaijoTextStream(false, _toolLabel);
                        }
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
                        const thinking = (event.reasoning as string) ?? (event.thinking as string) ?? "";
                        setStreamingSteps(sessionId, current.map((s) =>
                            s.agentName === agentName
                                ? { ...s, step: (event.step as string) ?? s.step, result, thinking, ...(code ? { code } : {}), status: "done" as const }
                                : s,
                        ));
                    } else if (event.type === "generator_chunk") {
                        const c = (event.html as string) ?? "";
                        thaijoHtmlBufferRef.current += c;
                        appendThaijoHtmlChunk(c);
                    } else if (event.type === "result") {
                        // ── Obsidian / Knowledge Vault pipeline result ───────────────
                        finishThaijoTextStream();
                        const obsContent = (event.content as string) ?? "";
                        const obsNotes = (event.notesReferenced as ObsidianNoteRef[]) ?? [];
                        const obsFollowUps = (event.followUps as string[]) ?? [];
                        const obsAgentSteps = (getStreamingSteps(sessionId) ?? []).map((s) => ({
                            ...s,
                            status: "done" as const,
                        }));
                        clearStreamingState(sessionId);
                        const obsCompletedState: ChatSessionState = {
                            ...getChatSessionState(sessionId),
                            sessionId,
                            status: "completed",
                            error: undefined,
                            messages: [
                                ...getChatSessionState(sessionId).messages,
                                createChatSessionMessage("ai", obsContent, obsAgentSteps, undefined, obsNotes, obsFollowUps),
                            ],
                            lastUserPrompt: trimmedMessage,
                        };
                        saveChatSessionState(sessionId, obsCompletedState);
                        void persistHistory(sessionId, obsCompletedState);
                    } else if (event.type === "final") {
                        finishThaijoTextStream();

                        // ── Report tool: stream AI result to right pane ──────────────
                        // report-gather mode ข้ามบล็อกนี้ — content ถูก stream ผ่าน text_chunk แล้ว
                        // การเรียก startThaijoTextStream() อีกครั้งจะ reset wizardEnabled=false
                        const hasHtmlReport = !!(event.reportHtml as string) || !!thaijoHtmlBufferRef.current;
                        const isReportGather = REPORT_DATA_SOURCES.some(t => effectiveTools.includes(t));
                        if (currentSelectedTools.includes("report") && !hasHtmlReport && !isReportGather) {
                            const msg = (event.message as string) ?? "";
                            if (msg) {
                                startThaijoTextStream();
                                appendThaijoTextChunk(msg);
                                finishThaijoTextStream();
                            }
                        }

                        // บันทึก search state สำหรับ report generator
                        if (event.textResult) {
                            setThaijoSearchState({
                                query:        (event.reportTitle as string) ?? "",
                                articlesText: (event.articlesText as string) ?? "",
                                articleCount: (event.articleCount as number) ?? 0,
                            });
                        }
                        // ดึง streaming steps ที่สะสมระหว่าง real-time ก่อน clear
                        const streamedSteps = getStreamingSteps(sessionId) ?? [];
                        clearStreamingState(sessionId);
                        const rawSteps = (event.agentSteps as AgentStep[] | null) ?? [];
                        const agentSteps = (rawSteps.length > 0 ? rawSteps : streamedSteps).map((s) => ({
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
                        // โหมด "สร้างรายงาน" — เนื้อหาเต็มสตรีมไปช่องขวา ("ข้อมูลพื้นฐาน") แล้ว
                        // ช่องซ้ายแสดงแค่ป้ายชี้ทาง ไม่ต้องซ้ำเนื้อหาทั้งก้อนอีกรอบ
                        const leftPaneText = isReportMode
                            ? "รวบรวมข้อมูลพื้นฐานเสร็จแล้ว — ดูรายละเอียดและกดสร้างรายงานได้ที่ช่อง \"ข้อมูลพื้นฐาน\" ด้านขวา →"
                            : (event.message as string);
                        const completedState: ChatSessionState = {
                            ...getChatSessionState(sessionId),
                            sessionId,
                            status: "completed",
                            error: undefined,
                            messages: [
                                ...getChatSessionState(sessionId).messages,
                                createChatSessionMessage("ai", leftPaneText, agentSteps, sourceFile),
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
            const isAbort = error instanceof Error && error.name === "AbortError";

            // ── refresh / ปิดแท็บ ─────────────────────────────────────────────
            // อย่าเขียน "failed" ทับ — ปล่อย status="running" ไว้ ให้ backend รันต่อ
            // จนจบและบันทึกผลลง DB แล้ว recovery polling จะโหลดผลกลับมาเอง
            if (isUnloadingRef.current) {
                return; // finally ยังทำงาน (setIsSubmitting(false))
            }

            // ── ผู้ใช้กดปุ่ม stop เอง ────────────────────────────────────────────
            // เคลียร์สถานะ "กำลังทำงาน" ทันที ไม่รอ backend — ต่างจาก refresh ตรงที่
            // ผู้ใช้ตั้งใจยกเลิกจริง ๆ ไม่ต้องการให้คำตอบโผล่มาทีหลัง
            if (isAbort) {
                clearStreamingState(sessionId);
                const stoppedState: ChatSessionState = {
                    ...getChatSessionState(sessionId),
                    sessionId,
                    status: "idle",
                    error: undefined,
                };
                saveChatSessionState(sessionId, stoppedState);
                void persistHistory(sessionId, stoppedState);
                return;
            }

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

    /** ยกเลิกการตอบกลับที่กำลังสตรีมอยู่ — ปุ่มส่งกลายเป็นปุ่ม stop ตอน isSubmitting */
    const handleStop = () => {
        abortControllerRef.current?.abort();
    };

    /** อ่านไฟล์เป็น base64 ในเบราว์เซอร์ — ไม่ upload ไปที่ใดเลย */
    const readAsBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingFile(true);
        try {
            const content = await readAsBase64(file);
            const id = Math.floor(Math.random() * 900000 + 100000).toString();
            const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
            attachFile({ id, name: file.name, extension, content });
        } catch (err) {
            console.error("File read error:", err);
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
            const content = await readAsBase64(file);
            const id = Math.floor(Math.random() * 900000 + 100000).toString();
            const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
            attachFile({ id, name: file.name, extension, content, previewUrl });
        } catch (err) {
            URL.revokeObjectURL(previewUrl);
            console.error("Image read error:", err);
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

            {/* Active tool pills — only shown when tools are selected (ถามปกติ = no pills) */}
            {selectedTools.length > 0 && (
                <div className="flex items-center flex-wrap gap-1.5 mb-2 px-1">
                    {selectedTools.map((id) => {
                        const def = TOOL_DEFS.find(d => d.id === id);
                        if (!def) return null;
                        const { labelTh, bgColor, borderColor, textColor, Icon } = def;
                        return (
                            <div
                                key={id}
                                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                                style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}`, color: textColor }}
                            >
                                <Icon size={12} />
                                <span>{labelTh}</span>
                                <button
                                    type="button"
                                    onClick={() => removeTool(id)}
                                    className="ml-0.5 text-base leading-none hover:opacity-70 transition-opacity"
                                >×</button>
                            </div>
                        );
                    })}
                    {selectedTools.length > 1 && (
                        <span className="text-[10px] text-gray-400 italic">
                            รวมผลลัพธ์จาก {selectedTools.length} เครื่องมือ
                        </span>
                    )}
                </div>
            )}

            {/* Popover เพิ่มไฟล์ */}
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

            {/* Popover เครื่องมือ — multi-select */}
            {showToolsMenu && (
                <div className="absolute bottom-18 left-24 bg-white rounded-xl shadow-lg border border-gray-100 p-2 w-72 flex flex-col gap-0.5 z-10">
                    <p className="text-[10px] text-gray-400 px-3 py-1.5 font-medium uppercase tracking-wider">
                        เลือกเครื่องมือ
                    </p>
                    {TOOL_DEFS.map(({ id, labelTh, desc, bgColor, borderColor, textColor, activeIconColor, Icon }) => {
                        const isActive = selectedTools.includes(id as ToolId);
                        return (
                            <button
                                key={id}
                                onClick={() => {
                                    const newId = id as ToolId;
                                    setSelectedTools(prev => prev.includes(newId) ? [] : [newId]);
                                    setShowToolsMenu(false);
                                }}
                                className={`flex items-start gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left border ${
                                    isActive ? "" : "border-transparent hover:bg-gray-50"
                                }`}
                                style={isActive ? {
                                    backgroundColor: bgColor,
                                    borderColor,
                                    color: textColor,
                                } : { color: "#334155" }}
                            >
                                {/* Checkbox indicator */}
                                <div
                                    className="mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                                    style={isActive
                                        ? { backgroundColor: textColor, border: "none" }
                                        : { border: "1.5px solid #cbd5e1", backgroundColor: "white" }
                                    }
                                >
                                    {isActive && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 12 12">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                                        </svg>
                                    )}
                                </div>
                                <Icon
                                    size={17}
                                    className="shrink-0 mt-0.5"
                                    style={{ color: isActive ? activeIconColor : "#64748b" }}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold leading-tight">{labelTh}</p>
                                    <p className="text-[11px] mt-0.5 leading-snug"
                                        style={{ color: isActive ? textColor : "#94a3b8" }}>
                                        {desc}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                    {selectedTools.length > 0 && (
                        <>
                            <div className="h-px bg-gray-100 mx-2 my-1" />
                            <button
                                onClick={() => setSelectedTools([])}
                                className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                                <FiX size={12} />
                                <span>ยกเลิกเครื่องมือทั้งหมด</span>
                            </button>
                        </>
                    )}
                </div>
            )}

            <div className="flex items-end w-full bg-[#f8f9fb] border border-gray-200 rounded-xl px-3 py-1.5 transition-all focus-within:border-gray-300 focus-within:bg-white text-sm">
                <HiOutlineLightBulb size={18} className="text-[#db5b24] mr-2.5 mb-1" />
                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleSend();
                        }
                        // Shift+Enter → ปล่อยพฤติกรรมปกติของ textarea (ขึ้นบรรทัดใหม่)
                    }}
                    placeholder={
                        selectedTools.length === 0
                            ? "พิมพ์ข้อความของคุณ..."
                            : `ถามด้วย ${selectedTools.map(id => TOOL_DEFS.find(d => d.id === id)?.labelTh).join(" + ")}...`
                    }
                    rows={1}
                    className="flex-1 outline-none bg-transparent text-gray-700 placeholder-gray-400 py-1 resize-none max-h-[160px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                />
                <button
                    onClick={() => { isSubmitting ? handleStop() : void handleSend(); }}
                    disabled={!isSubmitting && !message.trim()}
                    title={isSubmitting ? "หยุดการตอบกลับ" : "ส่งข้อความ"}
                    className={`text-white rounded-lg p-1.5 ml-2 mb-0.5 disabled:opacity-50 transition-all duration-150 flex items-center justify-center transform hover:scale-105 active:scale-90 ${
                        isSubmitting
                            ? "bg-[#2f9e44] hover:bg-[#268a3a] animate-pulse"
                            : message.trim()
                                ? "bg-[#f5b400] hover:bg-[#dba300] active:bg-[#e03131]"
                                : "bg-[#949eb0] hover:bg-[#7b8599]"
                    }`}
                >
                    {isSubmitting
                        ? <IoStop size={16} />
                        : <IoSend size={16} className="translate-x-0.5 -translate-y-0.5" />
                    }
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        showToolsMenu
                            ? "bg-[#e9ebf0] text-[#334155]"
                            : selectedTools.length > 0
                                ? "bg-[#eef3ff] text-[#3b5bdb] border border-[#b3c6f5]"
                                : "bg-[#f4f5f8] hover:bg-[#e9ebf0] text-[#334155]"
                    }`}
                >
                    <FiList className={selectedTools.length > 0 ? "text-[#4c6ef5]" : "text-[#db5b24]"} size={14} />
                    <span>เครื่องมือ</span>
                    {selectedTools.length > 0 && (
                        <span className="ml-0.5 bg-[#4c6ef5] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            {selectedTools.length}
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
};
