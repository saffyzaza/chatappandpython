"use client";
import { useState } from "react";
import { IoChevronDownOutline, IoChevronUpOutline } from "react-icons/io5";
import type { AgentStep } from "../../chat/chatTypes";

interface AgentPipelinePanelProps {
  steps: AgentStep[];
  isLive?: boolean;
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

const STEP_META: Record<string, { icon: string; color: string }> = {
  vault_rag: { icon: "📚", color: "text-emerald-500" },
  memory:     { icon: "🧠", color: "text-violet-400" },
  router:     { icon: "🔀", color: "text-blue-400" },
  reasoning:  { icon: "💡", color: "text-amber-400" },
  file_finder:{ icon: "🔍", color: "text-sky-400" },
  schema:     { icon: "🗂️", color: "text-indigo-400" },
  code_gen:   { icon: "⚙️", color: "text-orange-400" },
  executor:   { icon: "▶️", color: "text-teal-400" },
  insight:    { icon: "📊", color: "text-rose-400" },
  sql_agent:  { icon: "🗃️", color: "text-cyan-400" },
};

function StepRow({ step, isLast, isLive }: { step: AgentStep; isLast: boolean; isLive: boolean }) {
  const [open, setOpen] = useState(false);
  const isRunning = step.status === "running";
  const isDone = step.status === "done";
  const resultText = step.result?.trim() ?? "";
  const preview = resultText.length > 240 ? resultText.slice(0, 240) + "…" : resultText;
  const showPreview = Boolean(preview && !step.code);
  const meta = STEP_META[step.step ?? ""] ?? { icon: "•", color: "text-gray-400" };

  return (
    <div className={!isLast ? "mb-1" : ""}>
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left group"
        onClick={() => isDone && setOpen(!open)}
        disabled={!isDone}
      >
        <span className={`text-xs shrink-0 ${meta.color}`}>{meta.icon}</span>
        <span className={`text-xs truncate flex-1 ${isRunning ? "text-gray-600" : isDone ? "text-gray-500" : "text-gray-400"}`}>
          {step.agentName}
        </span>

        {isRunning && <Spinner />}
        {isDone && resultText && (
          <span className="text-gray-300 group-hover:text-gray-400 shrink-0">
            {open ? <IoChevronUpOutline size={12} /> : <IoChevronDownOutline size={12} />}
          </span>
        )}
      </button>

      {open && isDone && (
        <div className="mt-1.5 mb-1 space-y-1">
          {showPreview && (
            <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              {preview}
            </p>
          )}
          {step.code && (
            <pre className="text-[10px] bg-gray-900 text-gray-100 rounded-lg p-2 overflow-x-auto max-h-44 overflow-y-auto leading-relaxed w-full max-w-160">
              {step.code}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentPipelinePanel({ steps, isLive = false }: AgentPipelinePanelProps) {
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
