"use client";
import { useState, useCallback, useRef, useEffect, useSyncExternalStore } from "react";
import {
  getThaijoReport,
  subscribeToThaijoReport,
  setThaijoReport,
  startThaijoHtmlStream,
  appendThaijoHtmlChunk,
  getThaijoSearchState,
  subscribeToWizardOpen,
  subscribeToSearchReady,
} from "./thaijoStore";
import type { ThaijoTextStreamDetail, ThaiJoReportState } from "./thaijoStore";
import type { ThaiJoReportJson } from "./journal-template/buildJournalHtml";

/** แปลง HTML chunk เป็นข้อความอ่านได้ */
function htmlToLines(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<h1[^>]*>/gi, "\n\n# ").replace(/<\/h1>/gi, "\n")
    .replace(/<h2[^>]*>/gi, "\n\n## ").replace(/<\/h2>/gi, "\n")
    .replace(/<h3[^>]*>/gi, "\n\n**").replace(/<\/h3>/gi, "**\n")
    .replace(/<h[4-6][^>]*>/gi, "\n**").replace(/<\/h[4-6]>/gi, "**\n")
    .replace(/<(p|div|section|article)[^>]*>/gi, "\n")
    .replace(/<\/(p|div|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/li>/gi, "")
    .replace(/<td[^>]*>/gi, " | ").replace(/<\/td>/gi, "")
    .replace(/<th[^>]*>/gi, " **").replace(/<\/th>/gi, "** |")
    .replace(/<tr[^>]*>/gi, "\n").replace(/<\/tr>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface RightPaneProps {
  onClose?: () => void;
  onShowLeftPane?: () => void;
  showLeftPaneButton?: boolean;
}

// ── Render bold **text** inside a line ────────────────────────────────────────
function LineWithBold({ line }: { line: string }) {
  if (!line.includes("**")) return <>{line}</>;
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-bold text-gray-900">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function StreamText({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <div className="font-[Sarabun,'TH_Sarabun_New',sans-serif] text-[14px] leading-relaxed text-gray-800 whitespace-pre-wrap">
      {text.split("\n").map((line, i) => (
        <span key={i}>
          <LineWithBold line={line} />
          {"\n"}
        </span>
      ))}
      {streaming && (
        <span className="inline-block w-[2px] h-[1em] bg-[#1a6b3c] align-middle animate-pulse ml-0.5" />
      )}
    </div>
  );
}

export const RightPane = ({ onClose, onShowLeftPane, showLeftPaneButton = false }: RightPaneProps) => {
  // ── HTML stream (legacy report) ───────────────────────────────────────────
  const [isHtmlStreaming, setIsHtmlStreaming] = useState(false);
  const [hasFirstChunk, setHasFirstChunk] = useState(false);
  const streamIframeRef = useRef<HTMLIFrameElement>(null);
  const streamDocOpenRef = useRef(false);

  // ── Text stream (article summaries) ──────────────────────────────────────
  const [bufferText, setBufferText] = useState("");    // full text from backend
  const [displayText, setDisplayText] = useState(""); // typewriter display
  const [isTextStreaming, setIsTextStreaming] = useState(false);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const generateReportRef = useRef<(docType: string) => Promise<void>>(() => Promise.resolve());

  // ── View mode toggle (text ↔ html) ─────────────────────────────────────
  const [viewMode, setViewMode] = useState<"text" | "html">("text");

  // ── Restore state from store on mount (RightPane may remount after hide) ──
  useEffect(() => {
    const search = getThaijoSearchState();
    const savedReport = getThaijoReport();
    if (search?.articlesText) {
      setBufferText(search.articlesText);
      setDisplayText(search.articlesText);
    }
    if (savedReport?.reportHtml) {
      setViewMode("html");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Saved reports (shown in empty state) ─────────────────────────────────
  type SavedMeta = { id: string; title: string; doc_type: string; created_at: string };
  const [savedReports, setSavedReports] = useState<SavedMeta[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [openingLibId, setOpeningLibId] = useState<string | null>(null);

  // fetch คลัง เมื่อ empty state ปรากฏ
  const fetchLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      const r = await fetch("/api/journal-reports");
      if (!r.ok) return;
      const d = await r.json() as { reports: SavedMeta[] };
      setSavedReports(d.reports ?? []);
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  // โหลด report จาก DB แล้วแสดงใน iframe
  const handleOpenSaved = useCallback(async (id: string) => {
    setOpeningLibId(id);
    try {
      const r = await fetch(`/api/journal-reports/${id}`);
      const d = await r.json() as { report: { html_content: string; title: string } };
      const html = d.report.html_content;
      // inject เข้า store เพื่อให้ปุ่ม Download / เปิดหน้าใหม่ ทำงานได้
      setThaijoReport({
        reportJson: { title: d.report.title } as ThaiJoReportJson,
        reportHtml: html,
        sessionId: "",
        articleCount: 0,
      });
      setViewMode("html");
    } catch {
      alert("เปิดรายงานไม่สำเร็จ");
    } finally {
      setOpeningLibId(null);
    }
  }, []);

  // ── HTML stream event listener ────────────────────────────────────────────
  useEffect(() => {
    const onStreamChunk = (e: Event) => {
      const ev = e as CustomEvent<{ reset: boolean; chunk: string }>;
      const iframe = streamIframeRef.current;
      if (!iframe) return;
      if (ev.detail.reset) {
        setIsHtmlStreaming(true);
        setHasFirstChunk(false);
        iframe.contentDocument?.open();
        streamDocOpenRef.current = true;
      } else if (ev.detail.chunk && streamDocOpenRef.current) {
        setHasFirstChunk(true);
        iframe.contentDocument?.write(ev.detail.chunk);
      }
    };
    const onReportReady = () => {
      if (streamDocOpenRef.current) {
        streamIframeRef.current?.contentDocument?.close();
        streamDocOpenRef.current = false;
      }
      setIsHtmlStreaming(false);
    };
    window.addEventListener("thaijo-html-stream", onStreamChunk);
    window.addEventListener("thaijo-report-updated", onReportReady);
    return () => {
      window.removeEventListener("thaijo-html-stream", onStreamChunk);
      window.removeEventListener("thaijo-report-updated", onReportReady);
    };
  }, []);

  // ── Text stream event listener ────────────────────────────────────────────
  useEffect(() => {
    const onTextStream = (e: Event) => {
      const ev = e as CustomEvent<ThaijoTextStreamDetail>;
      if (ev.detail.reset) {
        setBufferText("");
        setDisplayText("");
        setIsTextStreaming(true);
        setWizardPhase(null);
        setWizardTopics([]);
        setWizardNotes({});
        setSaveStatus("idle");
        setSavedReportId(null);
        setWizardDirectMode(false);
        setSearchReady(false);
        setWizardEnabled(ev.detail.showWizard ?? false);
        if (ev.detail.label) setContentLabel(ev.detail.label);
        // Clear old report when starting a new wizard flow so the wizard can appear
        if (ev.detail.showWizard) setThaijoReport(null);
      } else if (ev.detail.done) {
        setIsTextStreaming(false);
      } else if (ev.detail.chunk) {
        setBufferText((prev) => prev + ev.detail.chunk);
      }
    };
    window.addEventListener("thaijo-text-stream", onTextStream);
    return () => window.removeEventListener("thaijo-text-stream", onTextStream);
  }, []);

  // Typewriter effect — advance displayText toward bufferText
  useEffect(() => {
    if (displayText.length >= bufferText.length) return;
    const id = setTimeout(() => {
      setDisplayText(bufferText.slice(0, displayText.length + 8));
    }, 16); // ~8 chars per 16ms ≈ 500 chars/sec
    return () => clearTimeout(id);
  }, [displayText, bufferText]);

  // Auto-scroll ขณะ typewriter กำลังพิมพ์
  useEffect(() => {
    if (textContainerRef.current) {
      textContainerRef.current.scrollTop = textContainerRef.current.scrollHeight;
    }
  }, [displayText]);

  // Subscribe to HTML report store
  const report = useSyncExternalStore(subscribeToThaijoReport, getThaijoReport, () => null);

  // Download HTML report
  const handleDownload = useCallback(() => {
    if (!report?.reportHtml) return;
    const blob = new Blob([report.reportHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.reportJson?.title ?? "journal"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [report]);

  // เปิด HTML ในหน้าใหม่
  const handleOpenHtml = useCallback(() => {
    if (!report?.reportHtml) return;
    const blob = new Blob([report.reportHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }, [report]);

  // Print to PDF
  const handleDownloadPdf = useCallback(() => {
    if (!report?.reportHtml) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(report.reportHtml);
    w.document.close();
    w.addEventListener("load", () => { w.focus(); w.print(); });
    // fallback if load already fired
    setTimeout(() => { try { w.focus(); w.print(); } catch { /* noop */ } }, 800);
  }, [report]);

  // Download as Word (.doc via msword blob)
  const handleDownloadWord = useCallback(() => {
    if (!report?.reportHtml) return;
    const title = report.reportJson?.title ?? "journal";
    const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${title}</title></head><body>${report.reportHtml}</body></html>`;
    const blob = new Blob(["\ufeff", wordHtml], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [report]);

  // ── Report generation (triggered by wizard) ─────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Save status ───────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedReportId, setSavedReportId] = useState<string | null>(null);

  // ── Wizard state ─────────────────────────────────────────────────────────────
  type WizardTopic = { id: string; title: string; desc: string; checked: boolean };
  const [wizardPhase, setWizardPhase] = useState<"type" | "topics" | null>(null);
  const [wizardDocType, setWizardDocType] = useState("policy");
  const [wizardTopics, setWizardTopics] = useState<WizardTopic[]>([]);
  const [wizardNotes, setWizardNotes] = useState<Record<string, string>>({});
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  // จาก journal-report tool — เปิด wizard โดยตรงก่อนมี searchState
  const [wizardDirectMode, setWizardDirectMode] = useState(false);
  const [searchReady, setSearchReady] = useState(false);
  // เปิด wizard เฉพาะเมื่อ tool "สร้างรายงาน" ถูกเลือก
  const [wizardEnabled, setWizardEnabled] = useState(false);  // header label — อัปเดตตาม context ที่ใช้อยู่
  const [contentLabel, setContentLabel] = useState("Journal Report");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ title: "", desc: "" });
  const dragIdxRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const handleSelectDocType = useCallback(async (docType: string) => {
    const search = getThaijoSearchState();
    if (!search) return;
    setWizardDocType(docType);
    setWizardPhase("topics");
    setIsLoadingTopics(true);
    try {
      const res = await fetch("/api/thaijo-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: search.query, articles_text: search.articlesText, doc_type: docType }),
      });
      const data = await res.json() as { topics?: WizardTopic[] };
      setWizardTopics((data.topics ?? []).map((t) => ({ ...t, checked: true })));
    } catch {
      setWizardTopics([]);
    } finally {
      setIsLoadingTopics(false);
    }
  }, []);

  const startTopicEdit = (topic: WizardTopic) => {
    setEditingTopicId(topic.id);
    setEditDraft({ title: topic.title, desc: topic.desc });
  };
  const saveTopicEdit = () => {
    setWizardTopics((prev) =>
      prev.map((t) => t.id === editingTopicId ? { ...t, title: editDraft.title, desc: editDraft.desc } : t)
    );
    setEditingTopicId(null);
  };
  const deleteTopic = (id: string) => {
    setWizardTopics((prev) => prev.filter((t) => t.id !== id));
    if (editingTopicId === id) setEditingTopicId(null);
  };
  const addTopic = () => {
    const newId = `custom-${Date.now()}`;
    const draft = { title: "หัวข้อใหม่", desc: "" };
    setWizardTopics((prev) => [...prev, { id: newId, ...draft, checked: true }]);
    setEditingTopicId(newId);
    setEditDraft(draft);
  };

  const handleGenerateReport = useCallback(async (docType: string, topicPlan: string = "") => {
    const search = getThaijoSearchState();
    if (!search || isGenerating) return;
    setIsGenerating(true);
    startThaijoHtmlStream();
    const htmlParts: string[] = [];
    let firstChunk = true;
    const effectiveQuery = search.query;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode:          "thaijo-report",
          query:         effectiveQuery,
          articles_text: search.articlesText,
          doc_type:      docType,
          topic_plan:    topicPlan,
        }),
      });
      if (!res.ok || !res.body) throw new Error("ไม่สามารถสร้างรายงานได้");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          let ev: { type: string; [k: string]: unknown };
          try { ev = JSON.parse(line.slice(6)) as typeof ev; } catch { continue; }
          if (ev.type === "generator_chunk") {
            let h = (ev.html as string) ?? "";
            // strip markdown fence จาก chunk แรก
            if (firstChunk) {
              h = h.replace(/^```html?\s*/i, "").replace(/^```\s*/i, "");
              firstChunk = false;
            }
            htmlParts.push(h);
            appendThaijoHtmlChunk(h); // write ตรงเข้า iframe ทีละ chunk
          } else if (ev.type === "final") {
            const html = (ev.reportHtml as string) || htmlParts.join("");
            setThaijoReport({
              reportJson:   { title: (ev.reportTitle as string) ?? search.query } as ThaiJoReportJson,
              reportHtml:   html,
              sessionId:    "",
              articleCount: search.articleCount,
            });
            // Auto-save to database
            const reportTitle = (ev.reportTitle as string) ?? search.query;
            setSaveStatus("saving");
            setSavedReportId(null);
            fetch("/api/journal-reports", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title:         reportTitle,
                query:         search.query,
                doc_type:      docType,
                article_count: search.articleCount,
                topic_plan:    topicPlan,
                html_content:  html,
              }),
            })
              .then(async (r) => {
                const d = await r.json() as { id?: string; error?: string };
                if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
                setSavedReportId(d.id ?? null);
                setSaveStatus("saved");
              })
              .catch((err: unknown) => {
                console.error("[journal-save]", err);
                setSaveStatus("error");
              });
          }
        }
      }
    } catch (e) {
      console.error("Report generation error:", e);
    } finally {
      setIsGenerating(false);
      setViewMode("html");
      setWizardPhase(null);
    }
  }, [isGenerating]);

  // Sync ref so event listener always has latest version
  generateReportRef.current = handleGenerateReport;

  // Listen for external trigger (e.g. from chat bubble HTML button)
  useEffect(() => {
    const handler = () => { generateReportRef.current("policy"); };
    window.addEventListener("trigger-generate-html", handler);
    return () => window.removeEventListener("trigger-generate-html", handler);
  }, []);

  // Listen for journal-report tool: open Wizard immediately, wait for search state
  useEffect(() => {
    const unsub = subscribeToWizardOpen((query) => {
      setWizardDirectMode(true);
      setSearchReady(!!getThaijoSearchState());
      setWizardPhase("type");
      setWizardTopics([]);
      setWizardNotes({});
      setSaveStatus("idle");
      setSavedReportId(null);
      // reset text view so Wizard section is visible
      setBufferText(query ? `หัวข้อ: ${query}` : "");
      setDisplayText(query ? `หัวข้อ: ${query}` : "");
      setViewMode("text");
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When searchState arrives (background ThaiJo done), enable Wizard proceed button
  useEffect(() => {
    const unsub = subscribeToSearchReady(() => {
      if (wizardDirectMode) setSearchReady(true);
    });
    return unsub;
  }, [wizardDirectMode]);

  // ── View logic ────────────────────────────────────────────────────────────
  const isTyping = displayText.length < bufferText.length;
  const showCursor = isTextStreaming || isTyping;
  const showTextView = bufferText.length > 0 || isTextStreaming;
  const showActions = !showCursor && (bufferText.length > 0 || wizardDirectMode) && (wizardEnabled || wizardDirectMode) && !isHtmlStreaming && !isGenerating && !report;
  const showHtmlReport = !!report && !isHtmlStreaming && viewMode === "html";
  const showTextSection = (showTextView || wizardDirectMode) && !isHtmlStreaming && (viewMode === "text" || isGenerating);
  const showEmpty = !showTextSection && !showHtmlReport && !isHtmlStreaming;

  return (
    <div className="flex-1 h-full flex flex-col bg-[#fcfbf9] rounded-lg border border-[#e0e0e0] overflow-hidden font-sans">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-[#dadce0] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {showLeftPaneButton && (
            <button type="button" onClick={onShowLeftPane}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#f0dfd8] bg-white px-2.5 py-1.5 text-xs font-medium text-[#a04222] shadow-sm transition hover:bg-[#fff1eb] shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span>Chat</span>
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-[#202124] truncate max-w-[220px]">
              {report ? (report.reportJson?.title ?? contentLabel) : contentLabel}
            </span>
            {(isHtmlStreaming || isTextStreaming) && (
              <span className="text-xs bg-[#e8f5ee] text-[#1a6b3c] border border-[#aad5b8] rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
                {isHtmlStreaming ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1a6b3c] animate-pulse inline-block" />
                    กำลังสร้างรายงาน...
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1a6b3c] animate-pulse inline-block" />
                    กำลังโหลด...
                  </span>
                )}
              </span>
            )}
            {/* Tab toggle: แสดงเมื่อมีทั้ง text และ HTML report แล้ว */}
            {!!report && bufferText.length > 0 && !isHtmlStreaming && (
              <div className="flex rounded-lg border border-[#d4edda] overflow-hidden ml-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("text")}
                  className={`px-2.5 py-1 text-xs font-semibold transition ${
                    viewMode === "text"
                      ? "bg-[#1a6b3c] text-white"
                      : "bg-white text-[#1a6b3c] hover:bg-[#e8f5ee]"
                  }`}
                >
                  📄 บทความ
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("html")}
                  className={`px-2.5 py-1 text-xs font-semibold transition ${
                    viewMode === "html"
                      ? "bg-[#1a6b3c] text-white"
                      : "bg-white text-[#1a6b3c] hover:bg-[#e8f5ee]"
                  }`}
                >
                  🖥️ HTML
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Save status indicator */}
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              กำลังบันทึก...
            </span>
          )}
          {saveStatus === "saved" && (
            <a
              href="/journal"
              target="_blank"
              className="flex items-center gap-1 text-xs text-[#1a6b3c] hover:underline"
              title="ดูรายงานที่บันทึก"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              บันทึกแล้ว
            </a>
          )}
          {saveStatus === "error" && (
            <span className="text-xs text-red-400">บันทึกไม่สำเร็จ</span>
          )}
          {report && !isHtmlStreaming && (
            <div className="flex items-center gap-1.5">
              {/* เปิดในหน้าใหม่ */}
              <button onClick={handleOpenHtml}
                className="inline-flex items-center gap-1.5 bg-[#1a6b3c] hover:bg-[#155c32] text-white px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>เปิดหน้า HTML</span>
              </button>
              {/* Download PDF */}
              <button onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 bg-[#c0392b] hover:bg-[#a93226] text-white px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>PDF</span>
              </button>
              {/* Download Word */}
              <button onClick={handleDownloadWord}
                className="inline-flex items-center gap-1.5 bg-[#2b579a] hover:bg-[#1e3f7a] text-white px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Word</span>
              </button>
              {/* Download HTML */}
              <button onClick={handleDownload}
                className="inline-flex items-center gap-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>HTML</span>
              </button>
            </div>
          )}
          <button onClick={onClose} className="p-1 hover:bg-[#f1f3f4] rounded text-[#5f6368] transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative min-h-0">

        {/* ── Text streaming view (articles / insights) ── */}
        {showTextSection && (
          <div
            ref={textContainerRef}
            className="h-full overflow-y-auto px-6 py-5 bg-white [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200"
          >
            <div className="max-w-2xl mx-auto">
              <StreamText text={displayText} streaming={showCursor} />

              {/* Journal Report Wizard — แสดงเมื่อ streaming เสร็จแล้ว */}
              {showActions && (
                <div className="mt-8 border-t border-[#e8f5ee] pt-6">
                  {/* Step 1: เลือกประเภทรายงาน */}
                  {(wizardPhase === null || wizardPhase === "type") && (
                    <>
                      <p className="text-sm font-semibold text-gray-700 mb-1">เลือกประเภทรายงาน</p>
                      {wizardDirectMode && !searchReady ? (
                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
                          <svg className="h-3.5 w-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          <span>กำลังรวบรวมข้อมูล (สถิติ + คลังความรู้ + วิจัย)... กรุณารอสักครู่</span>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mb-4">เลือกประเภทรายงานที่ต้องการสร้างจากบทความที่ค้นพบ</p>
                      )}
                      <div className="flex flex-col gap-3">
                        {[
                          { docType: "policy",   emoji: "📋", label: "สรุปรายงานนโยบาย",  desc: "Policy Brief — สรุปประเด็น ข้อเสนอแนะ และนโยบายที่เกี่ยวข้อง" },
                          { docType: "plan",     emoji: "📜", label: "เขียนแผนยุทธศาสตร์", desc: "Strategic Plan — วิเคราะห์สถานการณ์และแผนระยะยาว" },
                          { docType: "workplan", emoji: "📅", label: "แผนปฏิบัติงาน",      desc: "Work Plan — ขั้นตอน ผู้รับผิดชอบ และตัวชี้วัด" },
                        ].map(({ docType, emoji, label, desc }) => {
                          const waiting = wizardDirectMode && !searchReady;
                          return (
                            <button
                              key={docType}
                              type="button"
                              disabled={waiting}
                              onClick={() => void handleSelectDocType(docType)}
                              className={`flex items-start gap-3 w-full rounded-2xl border px-4 py-3 text-left transition ${
                                waiting
                                  ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                                  : "border-[#d4edda] bg-[#f0faf3] hover:border-[#1a6b3c] hover:bg-[#e8f5ee] hover:shadow-sm"
                              }`}
                            >
                              <span className="text-xl shrink-0 mt-0.5">{emoji}</span>
                              <div>
                                <p className="text-sm font-semibold text-[#1a6b3c]">{label}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Step 2: เลือกหัวข้อ */}
                  {wizardPhase === "topics" && (
                    <>
                      {/* Header + ย้อนกลับ */}
                      <div className="flex items-center gap-2 mb-4">
                        <button
                          type="button"
                          onClick={() => setWizardPhase("type")}
                          className="text-xs text-[#1a6b3c] hover:underline flex items-center gap-1"
                        >
                          ← ย้อนกลับ
                        </button>
                        <span className="text-sm font-semibold text-gray-700">
                          {wizardDocType === "policy" ? "📋 สรุปรายงานนโยบาย" : wizardDocType === "plan" ? "📜 แผนยุทธศาสตร์" : "📅 แผนปฏิบัติงาน"}
                        </span>
                      </div>

                      {isLoadingTopics ? (
                        <div className="flex items-center gap-2 text-sm text-[#1a6b3c] py-4">
                          <svg className="h-4 w-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>AI กำลังวิเคราะห์หัวข้อที่เหมาะสม...</span>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-gray-500 mb-3">เลือกหัวข้อที่ต้องการ และเพิ่มหมายเหตุ/รายละเอียดได้</p>
                          <div className="flex flex-col gap-2.5 mb-3">
                            {wizardTopics.map((topic, idx) => (
                              <div
                                key={topic.id}
                                draggable={editingTopicId !== topic.id}
                                onDragStart={() => { dragIdxRef.current = idx; }}
                                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const from = dragIdxRef.current;
                                  if (from !== null && from !== idx) {
                                    setWizardTopics((topics) => {
                                      const next = [...topics];
                                      const [removed] = next.splice(from, 1);
                                      next.splice(idx, 0, removed);
                                      return next;
                                    });
                                  }
                                  dragIdxRef.current = null;
                                  setDragOverIdx(null);
                                }}
                                onDragEnd={() => { dragIdxRef.current = null; setDragOverIdx(null); }}
                                className={`rounded-xl border p-3 transition ${
                                  dragOverIdx === idx
                                    ? "border-[#1a6b3c] bg-[#e8f5ee] shadow-md"
                                    : "border-[#d4edda] bg-[#f8fff8]"
                                }`}
                              >
                                {editingTopicId === topic.id ? (
                                  <div className="flex flex-col gap-1.5">
                                    <input
                                      autoFocus
                                      value={editDraft.title}
                                      onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                                      placeholder="ชื่อหัวข้อ"
                                      onKeyDown={(e) => { if (e.key === "Enter") saveTopicEdit(); if (e.key === "Escape") setEditingTopicId(null); }}
                                      className="w-full rounded-lg border border-[#d4edda] bg-white px-2.5 py-1.5 text-sm font-semibold text-[#1a6b3c] outline-none focus:border-[#1a6b3c] focus:ring-1 focus:ring-[#1a6b3c]/20"
                                    />
                                    <input
                                      value={editDraft.desc}
                                      onChange={(e) => setEditDraft((d) => ({ ...d, desc: e.target.value }))}
                                      placeholder="คำอธิบาย (ไม่บังคับ)"
                                      onKeyDown={(e) => { if (e.key === "Enter") saveTopicEdit(); if (e.key === "Escape") setEditingTopicId(null); }}
                                      className="w-full rounded-lg border border-[#d4edda] bg-white px-2.5 py-1.5 text-xs text-gray-600 outline-none focus:border-[#1a6b3c] focus:ring-1 focus:ring-[#1a6b3c]/20"
                                    />
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <button type="button" onClick={saveTopicEdit}
                                        className="px-3 py-1 bg-[#1a6b3c] text-white text-xs font-semibold rounded-lg hover:bg-[#155c32] transition">
                                        บันทึก
                                      </button>
                                      <button type="button" onClick={() => setEditingTopicId(null)}
                                        className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200 transition">
                                        ยกเลิก
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start gap-2">
                                    <span
                                      className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 mt-0.5 shrink-0 select-none"
                                      title="ลากเพื่อเรียงลำดับ"
                                    >
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                                        <circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/>
                                        <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
                                        <circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/>
                                      </svg>
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={topic.checked}
                                      onChange={(e) =>
                                        setWizardTopics((prev) =>
                                          prev.map((t) => t.id === topic.id ? { ...t, checked: e.target.checked } : t)
                                        )
                                      }
                                      className="mt-0.5 accent-[#1a6b3c] shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-[#1a6b3c]">{topic.title}</p>
                                      {topic.desc && <p className="text-xs text-gray-500 mt-0.5">{topic.desc}</p>}
                                      {topic.checked && (
                                        <textarea
                                          value={wizardNotes[topic.id] ?? ""}
                                          onChange={(e) =>
                                            setWizardNotes((prev) => ({ ...prev, [topic.id]: e.target.value }))
                                          }
                                          placeholder="เพิ่มหมายเหตุ หรือระบุเนื้อหาเพิ่มเติม..."
                                          rows={2}
                                          className="mt-1.5 w-full rounded-lg border border-[#d4edda] bg-white px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-400 outline-none resize-none focus:border-[#1a6b3c] focus:ring-1 focus:ring-[#1a6b3c]/20"
                                        />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 ml-1">
                                      <button
                                        type="button"
                                        onClick={() => startTopicEdit(topic)}
                                        className="p-1 text-gray-400 hover:text-[#1a6b3c] hover:bg-[#e8f5ee] rounded-md transition"
                                        title="แก้ไข"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteTopic(topic.id)}
                                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition"
                                        title="ลบ"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={addTopic}
                            className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-dashed border-[#aad5b8] bg-white hover:bg-[#e8f5ee] text-[#1a6b3c] text-xs font-semibold py-2 mb-4 transition"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            เพิ่มหัวข้อ
                          </button>
                          <button
                            type="button"
                            disabled={wizardTopics.every((t) => !t.checked)}
                            onClick={() => {
                              const selected = wizardTopics.filter((t) => t.checked);
                              const topicPlan = selected
                                .map((t) => `- ${t.title}${wizardNotes[t.id] ? `: ${wizardNotes[t.id]}` : ""}`)
                                .join("\n");
                              void handleGenerateReport(wizardDocType, topicPlan);
                            }}
                            className="w-full rounded-2xl bg-[#1a6b3c] text-white py-2.5 text-sm font-semibold hover:bg-[#155c32] disabled:opacity-40 transition"
                          >
                            สร้างรายงาน →
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Spinner ขณะ generate report */}
              {isGenerating && (
                <div className="mt-8 flex items-center gap-3 text-sm text-[#1a6b3c]">
                  <svg className="h-4 w-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>กำลังสร้างรายงาน กรุณารอสักครู่...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HTML streaming iframe ── */}
        {isHtmlStreaming && (
          <div className="absolute inset-0 overflow-auto bg-[#c8c8c8]">
            {/* Loading overlay — แสดงก่อน chunk แรกมาถึง */}
            {!hasFirstChunk && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-[#f4f7f6]">
                {/* Animated document icon */}
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 text-[#d4edda]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
                    <path fill="white" d="M14 2v6h6"/>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-7 h-7 animate-spin text-[#1a6b3c]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  </div>
                </div>

                {/* Steps */}
                <div className="flex flex-col gap-2.5 text-sm">
                  <div className="flex items-center gap-2.5 text-[#1a6b3c] font-medium">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a6b3c] text-white text-[10px] font-bold shrink-0">✓</span>
                    ค้นหาและวิเคราะห์บทความแล้ว
                  </div>
                  <div className="flex items-center gap-2.5 text-[#1a6b3c] font-medium">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a6b3c] text-white text-[10px] font-bold shrink-0">✓</span>
                    กำหนดโครงสร้างรายงานแล้ว
                  </div>
                  <div className="flex items-center gap-2.5 text-[#555] animate-pulse">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#1a6b3c] shrink-0">
                      <svg className="w-3 h-3 animate-spin text-[#1a6b3c]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    </span>
                    AI กำลังเขียนเนื้อหาเอกสาร...
                  </div>
                </div>

                <p className="text-xs text-gray-400 mt-1">อาจใช้เวลา 30–90 วินาที ขึ้นอยู่กับจำนวนหัวข้อ</p>
              </div>
            )}
            <iframe
              ref={streamIframeRef}
              title="Journal Streaming"
              className="border-none block"
              style={{ height: "12000px", width: "100%", minWidth: "860px", opacity: hasFirstChunk ? 1 : 0 }}
            />
          </div>
        )}
        {/* hidden iframe รอรับ event เมื่อ isHtmlStreaming = false */}
        {!isHtmlStreaming && (
          <iframe
            ref={streamIframeRef}
            title="Journal Streaming Hidden"
            className="border-none"
            style={{ display: "none" }}
          />
        )}

        {/* ── HTML report (final — stable srcDoc, scrollable) ── */}
        {showHtmlReport && (
          <div className="absolute inset-0 overflow-auto bg-[#c8c8c8]">
            <iframe
              key={report.reportHtml.slice(0, 60)}
              srcDoc={report.reportHtml}
              title="Journal Preview"
              className="border-none block"
              style={{ height: "12000px", width: "100%", minWidth: "860px" }}
            />
          </div>
        )}

        {/* ── Empty state ── */}
        {showEmpty && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* เมื่อยังไม่ได้โหลดรายการ */}
            {savedReports.length === 0 && !loadingLibrary && (
              <div className="flex flex-col items-center justify-center flex-1 gap-4 text-gray-400 select-none px-6">
                <svg className="w-14 h-14 opacity-20" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500 mb-1">ยังไม่มีผลลัพธ์</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    พิมพ์หัวข้อในช่องแชต แล้วเลือก<br />
                    <strong className="text-[#1a6b3c]">เครื่องมือ → วิจัย ThaiJo</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchLibrary()}
                  className="mt-1 flex items-center gap-1.5 text-xs text-[#1a6b3c] border border-[#aad5b8] bg-[#e8f5ee] px-3 py-1.5 rounded-xl hover:bg-[#d0edda] transition font-semibold"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  ดูรายงานที่บันทึกไว้
                </button>
              </div>
            )}

            {/* Loading */}
            {loadingLibrary && (
              <div className="flex items-center justify-center flex-1 gap-2 text-[#1a6b3c] text-sm">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                กำลังโหลด...
              </div>
            )}

            {/* รายการรายงาน */}
            {savedReports.length > 0 && (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                  <span className="text-sm font-semibold text-gray-700">📚 รายงานที่บันทึกไว้</span>
                  <a href="/journal" target="_blank" className="text-xs text-[#1a6b3c] hover:underline">ดูทั้งหมด →</a>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
                  {savedReports.map((r) => {
                    const emoji = r.doc_type === "policy" ? "📋" : r.doc_type === "plan" ? "📜" : "📅";
                    const dt = new Date(r.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
                    return (
                      <div key={r.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 hover:border-[#aad5b8] hover:bg-[#f0faf3] transition">
                        <span className="text-lg shrink-0">{emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{r.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{dt}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleOpenSaved(r.id)}
                          disabled={openingLibId === r.id}
                          className="shrink-0 flex items-center gap-1 bg-[#1a6b3c] hover:bg-[#155c32] text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                        >
                          {openingLibId === r.id ? (
                            <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                          ) : "เปิด"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
