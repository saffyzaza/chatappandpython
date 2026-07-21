"use client"
import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IoSend, IoStop } from "react-icons/io5";
import { HiOutlineLightBulb, HiOutlineSparkles } from "react-icons/hi";
import {
    FiPlus, FiList, FiPaperclip, FiImage, FiCamera,
    FiSearch, FiX, FiActivity, FiBookOpen, FiBook, FiClipboard,
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
import {
    startReportSources,
    setReportSourceStatus,
    clearReportSources,
    getReportSources,
} from "../../chat/reportSourceStore";
import type { ReportSourceStatus } from "../../chat/reportSourceStore";
import type { ThaiJoReportJson } from "../../chat/journal-template/buildJournalHtml";
import {
    openPreGatherTopics,
    subscribeToPreGatherConfirmOnce,
} from "../../chat/preGatherTopicsStore";
import type { PreGatherConfirmDetail } from "../../chat/preGatherTopicsStore";
import { setReportReady } from "../../chat/reportReadyStore";

type ChatInputProps = {
    onToggleDatabaseExplorer?: () => void;
};

// ── Tool definitions ───────────────────────────────────────────────────────────
const TOOL_DEFS = [
    {
        id: "report",
        labelTh: "เเผนหรือนโยบาย",
        desc: "สร้างเอกสารรายงาน นโยบาย เเผนปฎิบัติงาน เเละ เเผน ....",
        bgColor: "#fff9db", borderColor: "#ffe066", textColor: "#7c6600",
        activeIconColor: "#f08c00",
        Icon: FiClipboard,
    },
    {
        id: "stats",
        labelTh: "ข้อมูลสถิติ",
        desc: "ค้นหาข้อมูลจากระบบฐานข้อมูลเเละไฟล์ตารางข้อมูล",
        bgColor: "#f3f0ff", borderColor: "#c5b4f5", textColor: "#6741d9",
        activeIconColor: "#7c4ad9",
        Icon: FiActivity,
    },
    {
        id: "tavily",
        labelTh: "ข้อมูลจากเว็บ",
        desc: "ค้นหาข้อมูลผ่านระบบอินเตอร์เน็ต เว็บไชต์ที่เกี่ยวข้อง",
        bgColor: "#fff3ee", borderColor: "#f5c7ad", textColor: "#c85f35",
        activeIconColor: "#eb6f45",
        Icon: FiSearch,
    },
    {
        id: "thaijo",
        labelTh: "ฐานข้อมูลวิจัย",
        desc: "ค้นหาบทความวิจันจาก ThaiJo เเละ Pubmed",
        bgColor: "#eef5ee", borderColor: "#aad5b8", textColor: "#1a6b3c",
        activeIconColor: "#2e9e5b",
        Icon: FiBookOpen,
    },
    {
        id: "obsidian",
        labelTh: "คลังรายงาน",
        desc: "ค้นหาข้อมูลจากเอกสารรายงาน เขตสุขภาพที่ 10 เเละจังหวัดในเขต",
        bgColor: "#f0fdfa", borderColor: "#99f6e4", textColor: "#0f766e",
        activeIconColor: "#0d9488",
        Icon: FiBook,
    },
] as const;

type ToolId = typeof TOOL_DEFS[number]["id"];

// "วิจัย" มี sub-source ให้เลือกได้ว่าจะค้น ThaiJo, PubMed หรือทั้งสองอย่าง (ค่าเริ่มต้น)
type ResearchSource = "thaijo" | "pubmed";
const ALL_RESEARCH_SOURCES: ResearchSource[] = ["thaijo", "pubmed"];
const RESEARCH_SOURCE_LABELS: Record<ResearchSource, string> = {
    thaijo: "ThaiJo",
    pubmed: "PubMed",
};

// "สร้างรายงาน" — เลือกชนิดเอกสารล่วงหน้าตอนเลือกเครื่องมือ แทนที่จะรอถามหลังรวบรวม
// ข้อมูลเสร็จ (เดิม wizard จะถามทีหลัง ทำให้ผู้ใช้ต้องรอเพิ่มอีกรอบก่อนเริ่มสร้างหัวข้อ)
type ReportDocType = "policy" | "plan" | "workplan";
const REPORT_DOC_TYPES: { id: ReportDocType; label: string }[] = [
    { id: "policy",   label: "สรุปนโยบาย (Policy Brief)" },
    { id: "plan",     label: "แผนยุทธศาสตร์ (Strategic Plan)" },
    { id: "workplan", label: "แผนปฏิบัติงาน (Work Plan)" },
];
const REPORT_DOC_TYPE_LABELS: Record<ReportDocType, string> = {
    policy: "Policy Brief", plan: "Strategic Plan", workplan: "Work Plan",
};

const TOOL_MODE_MAP: Record<ToolId, string> = {
    stats:           "stats",
    report:          "report",
    tavily:          "tavily",
    thaijo:          "thaijo", // ค่า fallback — mode จริงคำนวณจาก researchSources (ดู getEffectiveMode)
    obsidian:        "obsidian",
};

// เครื่องมือที่ "สร้างรายงาน" จะดึงข้อมูลอัตโนมัติ (backend รวม ThaiJo + PubMed เสมอ)
const REPORT_DATA_SOURCES: ToolId[] = ["stats", "obsidian", "thaijo", "tavily"];

const DATA_LABELS: Partial<Record<ToolId, string>> = {
    thaijo:   "บทความวิจัย",
    obsidian: "คลังความรู้",
    stats:    "สถิติ",
    tavily:   "ค้นหา",
};

const _emptySnapshot: never[] = [];
const emptyAttachedFiles = () => _emptySnapshot;

const MAX_TEXTAREA_HEIGHT = 160; // px — เกินนี้ให้ scroll แทนการขยายต่อ

// ── Follow-up question sanitizer (defense-in-depth) ─────────────────────────────
// Backend (obsidian_fullcontext.py) ตอนนี้บังคับ follow_ups ให้เป็น structured
// JSON block อยู่แล้ว แต่ยังกรองซ้ำอีกชั้นตรงนี้ กันเผลอ: ถ้า LLM/parser ฝั่ง
// backend หลุดจริง ๆ (bug ในอนาคต, หรือ backend เวอร์ชันเก่ายังไม่อัปเดต) จะได้
// ไม่โผล่เป็นปุ่มพัง ๆ ให้ผู้ใช้เห็น (เช่น "**สรุปคำตอบ**" ที่เจอมาก่อนหน้านี้)
function sanitizeFollowUps(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of raw) {
        if (typeof item !== "string") continue;
        const q = item.trim();
        if (!q) continue;
        if (!q.endsWith("?")) continue;      // ต้องเป็นประโยคคำถามเท่านั้น
        if (q.includes("**")) continue;       // ห้ามมี markdown bold หลุดมา
        if (q.includes("\n")) continue;       // ต้องเป็นบรรทัดเดียว
        if (q.length <= 5 || q.length > 160) continue;
        if (seen.has(q)) continue;
        seen.add(q);
        out.push(q);
        if (out.length >= 3) break;
    }
    return out;
}

export const ChatInput = ({ onToggleDatabaseExplorer }: ChatInputProps) => {
    const router = useRouter();
    const thaijoHtmlBufferRef = useRef("");
    const pathname = usePathname();
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showToolsMenu, setShowToolsMenu] = useState(false);
    const [selectedTools, setSelectedTools] = useState<ToolId[]>([]);
    // sub-source ของเครื่องมือ "วิจัย" — ค่าเริ่มต้นเลือกทั้ง ThaiJo และ PubMed
    const [researchSources, setResearchSources] = useState<Set<ResearchSource>>(
        () => new Set(ALL_RESEARCH_SOURCES)
    );
    // ชนิดเอกสารของเครื่องมือ "สร้างรายงาน" — เลือกล่วงหน้าก่อนกด ส่ง
    const [reportDocType, setReportDocType] = useState<ReportDocType>("policy");
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

    /** สลับ sub-source ของ "วิจัย" — กันไม่ให้ยกเลิกจนเหลือ 0 แหล่ง (ต้องมีอย่างน้อย 1) */
    const toggleResearchSource = (src: ResearchSource) => {
        setResearchSources(prev => {
            const next = new Set(prev);
            if (next.has(src)) {
                if (next.size > 1) next.delete(src);
            } else {
                next.add(src);
            }
            return next;
        });
    };

    /** Compute the API mode from selected tools */
    const getEffectiveMode = (tools: ToolId[], hasFiles: boolean): string => {
        // Files attached → force database mode
        if (hasFiles) return "database";
        if (tools.length === 0) return "normal";
        // report → รวบรวมจาก 3 แหล่ง (thaijo + obsidian + stats) แล้วเปิด wizard
        if (tools.includes("report")) return "report-gather";
        const nonReport = tools.filter(t => t !== "report");
        if (nonReport.length === 1) {
            const only = nonReport[0];
            // "วิจัย" ตัดสินโหมดจริงจาก sub-source ที่เลือก: ทั้งคู่ → research,
            // เลือกแค่อย่างเดียว → ส่งตรงไป thaijo หรือ pubmed
            if (only === "thaijo") {
                const hasThaijo = researchSources.has("thaijo");
                const hasPubmed = researchSources.has("pubmed");
                if (hasThaijo && hasPubmed) return "research";
                if (hasPubmed) return "pubmed";
                return "thaijo";
            }
            return TOOL_MODE_MAP[only] ?? "thaijo";
        }
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

    /** โหมด "สร้างรายงาน" ขั้นใหม่ — ให้ AI เดาหัวข้อจากคำถามอย่างเดียวก่อน (ไม่มีข้อมูล
     * จริงรองรับ) แล้วเปิดหน้าจอให้ผู้ใช้เลือก/แก้ไข/ใส่หมายเหตุ ก่อนค่อยยิงไปรวบรวม
     * ข้อมูลจริงจาก 5 แหล่ง — กันปัญหาเดิมที่ยิง prompt สั้นๆ ห้วนๆ ไปตรงๆ แล้วได้ผลลัพธ์
     * ไม่ตรงจุดที่ต้องการ ค่อยมาเลือกหัวข้อทีหลังตอนข้อมูลมาแล้ว (สายเกินไป/เสีย API โดยเปล่าประโยชน์)
     */
    const waitForTopicPlan = (query: string, docType: string): Promise<PreGatherConfirmDetail> => {
        return new Promise((resolve) => {
            const unsubscribe = subscribeToPreGatherConfirmOnce((detail) => resolve(detail));
            void (async () => {
                let topics: { id: string; title: string; desc: string }[] = [];
                try {
                    const res = await fetch("/api/thaijo-topics", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ query, articles_text: "", doc_type: docType }),
                    });
                    const data = await res.json() as { topics?: { id: string; title: string; desc: string }[] };
                    topics = data.topics ?? [];
                } catch {
                    // เน็ตมีปัญหา/backend ล่ม — เปิดหน้าจอเปล่าให้ผู้ใช้เพิ่มหัวข้อเองได้ ไม่ต้องบล็อกไว้
                }
                openPreGatherTopics(query, docType, topics.map((t) => ({ ...t, checked: true })));
            })();
            // เผื่อ component unmount ระหว่างรอ (เช่น ผู้ใช้เปลี่ยนหน้า) — เลิก subscribe กันหน่วยความจำรั่ว
            abortControllerRef.current?.signal.addEventListener("abort", unsubscribe, { once: true });
        });
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

            // ── ขั้นใหม่: เลือกหัวข้อ + ใส่หมายเหตุ "ก่อน" ยิงไปรวบรวมข้อมูลจริง ─────────
            // แทนที่จะยิง prompt ดิบๆ ไปที่ 5 แหล่งตรงๆ (เสี่ยงได้ผลลัพธ์ไม่ตรงจุด) ให้ AI
            // เดาหัวข้อจากคำถามอย่างเดียวก่อน แล้วรอผู้ใช้ยืนยัน/แก้ไข ก่อนค่อยเสริม prompt
            // ด้วยหัวข้อที่เลือกแล้วค่อยยิงจริง — เสร็จแล้วก็สร้างรายงานต่อได้เลยไม่ต้องถามซ้ำ
            let effectivePrompt = trimmedMessage;
            let topicPlanForReport = "";
            let effectiveDocType = reportDocType;
            if (isReportMode) {
                clearReportSources();
                const confirmed = await waitForTopicPlan(trimmedMessage, reportDocType);
                topicPlanForReport = confirmed.topicPlan;
                // ผู้ใช้เลือกประเภทเอกสารได้ใหม่ตอนหน้าจอ pre-gather (ดู RightPane wizardDocType
                // pills) — ใช้ค่าที่เลือกจริงแทน reportDocType เดิมที่ล็อกไว้ตอนกดปุ่มเครื่องมือ
                effectiveDocType = (confirmed.docType as ReportDocType) || reportDocType;
                setReportDocType(effectiveDocType);
                effectivePrompt = confirmed.topicPlan
                    ? `${trimmedMessage}\n\nโปรดเจาะลึกและรวบรวมข้อมูลตามหัวข้อต่อไปนี้:\n${confirmed.topicPlan}`
                    : trimmedMessage;
                startReportSources(effectivePrompt, sessionId);
            } else {
                clearReportSources();
            }

            const apiBody = {
                sessionId,
                prompt: effectivePrompt,
                history: nextMessages,
                mode: effectiveMode,
                tools: effectiveTools,
                attached_files: attachedFiles,
                ...(isReportMode ? { doc_type: effectiveDocType, report_title: trimmedMessage } : {}),
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
                            // report-gather → สตรีม "ข้อมูลพื้นฐาน" ไปช่องขวา
                            // ⚠️ ไม่ส่ง doc_type ตรงนี้แล้ว (ต่างจากเดิม) — ตอนนี้หัวข้อถูกเลือก
                            // ไว้ล่วงหน้าก่อนยิง gather แล้ว (ดู waitForTopicPlan) ไม่ต้องให้
                            // RightPane auto-regenerate หัวข้อซ้ำอีกรอบตอนข้อมูลมาถึง
                            startThaijoTextStream(true, "ข้อมูลพื้นฐาน");
                        } else {
                            const dataTools = effectiveTools.filter(t => t !== "report");
                            const _toolLabel = dataTools.length > 0
                                ? dataTools.map(t => {
                                    // "วิจัย" label ขึ้นกับ sub-source ที่เลือกจริง ไม่ใช่ label คงที่
                                    if (t === "thaijo") {
                                        const hasThaijo = researchSources.has("thaijo");
                                        const hasPubmed = researchSources.has("pubmed");
                                        // เลือกทั้งสองแหล่ง (โหมด research) → หัวข้อฝั่งขวาเรียก "ข้อมูลพื้นฐาน"
                                        // เหมือนโหมด "สร้างรายงาน" เพราะเนื้อหาซ้อนหลายแหล่งเข้าด้วยกัน
                                        if (hasThaijo && hasPubmed) return "ข้อมูลพื้นฐาน";
                                        if (hasPubmed) return "PubMed";
                                        return "บทความวิจัย (ThaiJo)";
                                    }
                                    return DATA_LABELS[t] ?? t;
                                }).join(" + ")
                                : "ผลลัพธ์";
                            startThaijoTextStream(false, _toolLabel);
                        }
                    } else if (event.type === "text_chunk") {
                        appendThaijoTextChunk((event.text as string) ?? "");
                    } else if (event.type === "crew_plan") {
                        setPlannedAgents(sessionId, event.agents as { name: string; role: string }[]);
                    } else if (event.type === "report_source_status") {
                        setReportSourceStatus(
                            event.source as string,
                            event.status as ReportSourceStatus,
                            event.label as string | undefined,
                            event.message as string | undefined,
                        );
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
                    } else if (event.type === "obsidian_stream_start") {
                        // เคลียร์ preview เก่า (ถ้ามี) ก่อนเริ่มสตรีมคำตอบใหม่เข้า step นี้
                        const step = event.step as string;
                        const current = getStreamingSteps(sessionId) ?? [];
                        setStreamingSteps(sessionId, current.map((s) =>
                            s.step === step ? { ...s, result: "" } : s,
                        ));
                    } else if (event.type === "obsidian_chunk") {
                        // สตรีมคำตอบ Obsidian สด ๆ เข้า step ที่กำลัง "running" อยู่ — ผู้ใช้
                        // เห็นคำตอบค่อย ๆ ก่อตัวในแผง AgentPipelinePanel แทนที่จะรอเงียบ ๆ
                        // ~50-60s แล้วโผล่มาทีเดียว (ตัว "result" event ท้ายสุดยังเป็นความ
                        // จริงหนึ่งเดียวเสมอ — ถ้า guard ฝั่ง backend ต้อง retry ก็จะเขียนทับ
                        // preview นี้ด้วยคำตอบที่ผ่านการตรวจสอบแล้วอยู่ดี)
                        const step = event.step as string;
                        const text = (event.text as string) ?? "";
                        const current = getStreamingSteps(sessionId) ?? [];
                        setStreamingSteps(sessionId, current.map((s) =>
                            s.step === step ? { ...s, result: (s.result ?? "") + text } : s,
                        ));
                    } else if (event.type === "result") {
                        // ── Obsidian / Knowledge Vault pipeline result ───────────────
                        finishThaijoTextStream();
                        const obsContent = (event.content as string) ?? "";
                        const obsNotes = (event.notesReferenced as ObsidianNoteRef[]) ?? [];
                        const obsFollowUps = sanitizeFollowUps(event.followUps);
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

                        // ── report-gather: หัวข้อถูกเลือกไว้ล่วงหน้าแล้ว (waitForTopicPlan)
                        // พอข้อมูลรวบรวมเสร็จ ไม่ auto-generate ทันที — ให้ผู้ใช้ตรวจสอบ
                        // "ข้อมูลพื้นฐาน" ที่รวบรวมมาก่อน แล้วกดปุ่มเองถึงจะเริ่มสร้าง HTML จริง
                        if (isReportMode) {
                            setReportReady({ docType: effectiveDocType, topicPlan: topicPlanForReport });
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

                        // ── บันทึกข้อมูล report-gather ลง DB เพื่อกู้คืน RightPane ได้หลัง
                        // reload หน้า (เดิมเนื้อหา + badge อยู่แค่ใน memory ฝั่ง browser
                        // พอ reload แล้วหายหมด ต้องรวบรวมข้อมูลใหม่ทั้งชุด) ──────────────
                        const reportData = isReportMode ? {
                            combinedText: (event.textResult as string) ?? "",
                            articlesText: (event.articlesText as string) ?? "",
                            articleCount: (event.articleCount as number) ?? 0,
                            query: trimmedMessage,
                            sources: getReportSources() ?? [],
                        } : undefined;

                        const completedState: ChatSessionState = {
                            ...getChatSessionState(sessionId),
                            sessionId,
                            status: "completed",
                            error: undefined,
                            messages: [
                                ...getChatSessionState(sessionId).messages,
                                createChatSessionMessage("ai", leftPaneText, agentSteps, sourceFile, undefined, undefined, reportData),
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
                        // "วิจัย" แสดง sub-source ที่เลือกต่อท้าย label / "สร้างรายงาน" แสดงชนิดเอกสาร
                        const displayLabel = id === "thaijo"
                            ? `${labelTh} (${[...researchSources].map(s => RESEARCH_SOURCE_LABELS[s]).join(" + ")})`
                            : id === "report"
                            ? `${labelTh} (${REPORT_DOC_TYPE_LABELS[reportDocType]})`
                            : labelTh;
                        return (
                            <div
                                key={id}
                                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                                style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}`, color: textColor }}
                            >
                                <Icon size={12} />
                                <span>{displayLabel}</span>
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
                            <div key={id}>
                                <button
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
                                {/* "วิจัย" — sub-source ให้เลือก ThaiJo / PubMed เมื่อถูกเลือกอยู่ */}
                                {id === "thaijo" && isActive && (
                                    <div
                                        className="ml-9 mr-2 mb-1 mt-0.5 flex flex-col gap-0.5 border-l-2 pl-2.5"
                                        style={{ borderColor }}
                                    >
                                        {ALL_RESEARCH_SOURCES.map((src) => {
                                            const checked = researchSources.has(src);
                                            return (
                                                <label
                                                    key={src}
                                                    className="flex items-center gap-2 px-1.5 py-1 rounded-md text-xs cursor-pointer hover:bg-gray-50"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleResearchSource(src)}
                                                        className="w-3.5 h-3.5 rounded accent-[#2e9e5b] cursor-pointer"
                                                    />
                                                    <span style={{ color: checked ? textColor : "#94a3b8" }}>
                                                        {RESEARCH_SOURCE_LABELS[src]}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                                {/* "สร้างรายงาน" — เลือกชนิดเอกสารล่วงหน้า เพื่อข้ามขั้นตอนถามซ้ำใน wizard ทีหลัง */}
                                {id === "report" && isActive && (
                                    <div
                                        className="ml-9 mr-2 mb-1 mt-0.5 flex flex-col gap-0.5 border-l-2 pl-2.5"
                                        style={{ borderColor }}
                                    >
                                        {REPORT_DOC_TYPES.map(({ id: dt, label }) => {
                                            const checked = reportDocType === dt;
                                            return (
                                                <label
                                                    key={dt}
                                                    className="flex items-center gap-2 px-1.5 py-1 rounded-md text-xs cursor-pointer hover:bg-gray-50"
                                                >
                                                    <input
                                                        type="radio"
                                                        name="reportDocType"
                                                        checked={checked}
                                                        onChange={() => setReportDocType(dt)}
                                                        className="w-3.5 h-3.5 accent-[#f08c00] cursor-pointer"
                                                    />
                                                    <span style={{ color: checked ? textColor : "#94a3b8" }}>
                                                        {label}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
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
