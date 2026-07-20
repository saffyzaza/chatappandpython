"use client";
import { useSyncExternalStore } from "react";
import { getReportSources, subscribeToReportSources } from "../../chat/reportSourceStore";
import type { ReportSourceStatus } from "../../chat/reportSourceStore";
import { retryReportSource } from "../../chat/reportRetry";

function RetryIcon() {
  return (
    <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function Dot({ status }: { status: ReportSourceStatus }) {
  if (status === "running") {
    return (
      <svg className="h-3 w-3 animate-spin text-[#1a6b3c] shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  }
  if (status === "done") {
    return (
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#1a6b3c] text-white text-[8px] font-bold shrink-0">
        ✓
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#c0392b] text-white text-[8px] font-bold shrink-0">
        ✕
      </span>
    );
  }
  return <span className="h-2 w-2 rounded-full bg-gray-300 shrink-0" />;
}

const STYLES: Record<ReportSourceStatus, string> = {
  pending: "border-gray-200 bg-gray-50 text-gray-400",
  running: "border-[#aad5b8] bg-[#f0faf3] text-[#1a6b3c]",
  done: "border-[#aad5b8] bg-[#e8f5ee] text-[#1a6b3c]",
  error: "border-[#f0c2ba] bg-[#fdf1ef] text-[#a04222]",
};

export function ReportSourceBadges() {
  const sources = useSyncExternalStore(subscribeToReportSources, getReportSources, () => null);
  if (!sources || sources.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-gray-100 bg-white">
      {sources.map((s) =>
        s.status === "error" ? (
          <button
            key={s.id}
            type="button"
            title={`${s.message ?? "ดึงข้อมูลไม่สำเร็จ"} — คลิกเพื่อลองใหม่`}
            onClick={() => void retryReportSource(s.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-[#fbe2dc] cursor-pointer ${STYLES[s.status]}`}
          >
            <Dot status={s.status} />
            {s.label}
            <RetryIcon />
          </button>
        ) : (
          <span
            key={s.id}
            title={s.message ?? s.label}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${STYLES[s.status]}`}
          >
            <Dot status={s.status} />
            {s.label}
          </span>
        )
      )}
    </div>
  );
}
