"use client";
import { useState } from "react";
import { IoChevronDownOutline, IoChevronUpOutline } from "react-icons/io5";
import type { AgentStep } from "../../chat/chatTypes";

interface AgentPipelinePanelProps {
  steps: AgentStep[];
  isLive?: boolean;
  elapsedSeconds?: number;
}

function formatElapsed(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function Spinner() {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1 h-1 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function StepRow({ step, isLast, isLive }: { step: AgentStep; isLast: boolean; isLive: boolean }) {
  const [open, setOpen] = useState(false);
  const isRunning = step.status === "running";
  const isDone = step.status === "done";
  const resultText = step.result?.trim() ?? "";
  const thinkingText = step.thinking?.trim() ?? "";
  const preview = resultText.length > 240 ? resultText.slice(0, 240) + "…" : resultText;
  const hasContent = Boolean(thinkingText || resultText || step.code);
  // ระหว่างที่ step ยัง "running" อยู่ (เช่น กำลังสตรีมคำตอบ Obsidian สด ๆ ผ่าน
  // obsidian_chunk) ให้โชว์ preview ที่กำลังก่อตัวทันทีโดยไม่ต้องรอ "done" หรือ
  // คลิกเปิดเอง — ลด perceived latency ของคำถามที่กินเวลานาน (~50-60s)
  const showLiveRunningPreview = isLive && isRunning && Boolean(resultText);
  const showDoneDetail = open && isDone;

  return (
    <div className={!isLast ? "mb-1" : ""}>
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left group"
        onClick={() => isDone && hasContent && setOpen(!open)}
        disabled={!isDone || !hasContent}
      >
        <span className={`text-xs truncate flex-1 ${isRunning ? "text-gray-600" : isDone ? "text-gray-500" : "text-gray-400"}`}>
          {step.agentName}
        </span>
        {isRunning && <Spinner />}
        {isDone && hasContent && (
          <span className="text-gray-300 group-hover:text-gray-400 shrink-0">
            {open ? <IoChevronUpOutline size={12} /> : <IoChevronDownOutline size={12} />}
          </span>
        )}
      </button>

      {(showDoneDetail || showLiveRunningPreview) && (
        <div className="mt-1.5 mb-1 space-y-1.5">
          {thinkingText && showDoneDetail && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              <p className="text-[10px] font-semibold text-amber-600 mb-1 flex items-center gap-1">
                <span>💡</span> วิธีคิด
              </p>
              <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-wrap">
                {thinkingText}
              </p>
            </div>
          )}
          {preview && !step.code && (
            <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              {preview}
              {showLiveRunningPreview && <span className="animate-pulse">▍</span>}
            </p>
          )}
          {step.code && showDoneDetail && (
            <pre className="text-[10px] bg-gray-900 text-gray-100 rounded-lg p-2 overflow-x-auto max-h-44 overflow-y-auto leading-relaxed w-full max-w-160">
              {step.code}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentPipelinePanel({ steps, isLive = false, elapsedSeconds }: AgentPipelinePanelProps) {
  const [expanded, setExpanded] = useState(false);
  if (!steps || steps.length === 0) return null;

  const showExpanded = isLive || expanded;

  return (
    <div className="mb-4">
      {/* Header */}
      {isLive ? (
        <div className="flex items-center gap-2 text-gray-400 mb-2 text-xs">
          <Spinner />
          <span>กำลังวิเคราะห์...</span>
          {elapsedSeconds !== undefined && elapsedSeconds > 0 && (
            <span className="ml-auto font-mono tabular-nums text-[11px] text-gray-400">
              {formatElapsed(elapsedSeconds)}
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-500 transition-colors mb-2 text-xs"
        >
          <span>แสดงวิธีคิด</span>
          {expanded ? <IoChevronUpOutline size={12} /> : <IoChevronDownOutline size={12} />}
        </button>
      )}

      {/* Steps */}
      {showExpanded && (
        <div className="pl-1">
          {steps.map((step, i) => (
            <StepRow
              key={i}
              step={step}
              isLast={i === steps.length - 1}
              isLive={isLive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
