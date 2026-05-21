"use client";
import { useState, useCallback, useRef, useEffect, useSyncExternalStore } from "react";
import { getThaijoReport, subscribeToThaijoReport, setThaijoReport, startThaijoHtmlStream, appendThaijoHtmlChunk } from "./thaijoStore";
import type { ThaiJoReportJson } from "./journal-template/buildJournalHtml";

interface RightPaneProps {
  onClose?: () => void;
  onShowLeftPane?: () => void;
  showLeftPaneButton?: boolean;
}

export const RightPane = ({ onClose, onShowLeftPane, showLeftPaneButton = false }: RightPaneProps) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const streamIframeRef   = useRef<HTMLIFrameElement>(null);
  const streamDocOpenRef  = useRef(false);

  // ── Live streaming iframe via direct DOM write ─────────────────────────────

  useEffect(() => {
    const onStreamChunk = (e: Event) => {
      const ev = e as CustomEvent<{ reset: boolean; chunk: string }>;
      const iframe = streamIframeRef.current;
      if (!iframe) return;

      if (ev.detail.reset) {
        setIsStreaming(true);
        iframe.contentDocument?.open();
        streamDocOpenRef.current = true;
      } else if (ev.detail.chunk && streamDocOpenRef.current) {
        iframe.contentDocument?.write(ev.detail.chunk);
      }
    };

    const onReportReady = () => {
      if (streamDocOpenRef.current) {
        streamIframeRef.current?.contentDocument?.close();
        streamDocOpenRef.current = false;
      }
      setIsStreaming(false);
    };

    window.addEventListener("thaijo-html-stream", onStreamChunk);
    window.addEventListener("thaijo-report-updated", onReportReady);
    return () => {
      window.removeEventListener("thaijo-html-stream", onStreamChunk);
      window.removeEventListener("thaijo-report-updated", onReportReady);
    };
  }, []);

  // Subscribe to ThaiJo report store
  const report = useSyncExternalStore(
    subscribeToThaijoReport,
    getThaijoReport,
    () => null,
  );

  // ── Download ─────────────────────────────────────────────────────────────────

  const handleDownload = useCallback(() => {
    if (!report?.reportHtml) return;
    const blob = new Blob([report.reportHtml], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `${report.reportJson?.title ?? "journal"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [report]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 h-full flex flex-col bg-[#fcfbf9] rounded-lg border border-[#e0e0e0] overflow-hidden font-sans">

      {/* ── Header ── */}
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
              {report ? (report.reportJson?.title ?? "Journal Report") : "Journal Report"}
            </span>
            {report && (
              <span className="text-xs bg-[#e8f5ee] text-[#1a6b3c] border border-[#aad5b8] rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
                📄 {report.articleCount} บทความ
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {report && (
            <button onClick={handleDownload}
              className="inline-flex items-center gap-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download</span>
            </button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-[#f1f3f4] rounded text-[#5f6368] transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Toolbar (only when report exists) ── */}
      {report && (
        <div className="flex items-center gap-0.5 px-3 py-1 bg-white border-b border-[#dadce0] min-h-[36px] select-none shrink-0">
          <button className="p-1.5 hover:bg-[#f1f3f4] rounded transition" title="พิมพ์"
            onClick={() => window.print()}>
            <svg className="w-4 h-4 text-[#5f6368]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
          <span className="ml-auto text-xs text-[#1a6b3c] font-medium pr-1">
            ✓ {report.reportJson?.results?.length ?? 0} sections
          </span>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto bg-[#d0d0d0]">
        {/* Streaming iframe — always mounted, visible only while streaming */}
        <iframe
          ref={streamIframeRef}
          title="Journal Streaming Preview"
          className="border-none block"
          style={{
            display: isStreaming ? "block" : "none",
            height: "12000px", width: "100%", minWidth: "860px",
          }}
        />
        {report && !isStreaming ? (
          <iframe
            key={report.reportHtml.slice(0, 60)}
            srcDoc={report.reportHtml}
            title="Journal Preview"
            className="border-none block"
            style={{ height: "12000px", width: "100%", minWidth: "860px" }}
          />
        ) : !isStreaming ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400 select-none px-6">
            <svg className="w-14 h-14 opacity-20" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500 mb-1">ยังไม่มี Journal Report</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                พิมพ์หัวข้อในช่องแชต แล้วเลือก<br />
                <strong className="text-[#1a6b3c]">เครื่องมือ → วิจัย ThaiJo</strong>
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
