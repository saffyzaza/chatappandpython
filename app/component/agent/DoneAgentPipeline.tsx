"use client";
import { useState } from "react";
import clsx from "clsx";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import type { AgentStep } from "@/app/chat/chatTypes";
import { getAgentCfg } from "./agentConfig";
import { DoneStepCard } from "./DoneStepCard";

type Props = { steps: AgentStep[]; messageId: string };

export function DoneAgentPipeline({ steps, messageId }: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-2.5 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm w-full">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50/80 hover:bg-gray-100/60 transition-colors"
      >
        <div className="flex -space-x-1 shrink-0">
          {steps.slice(0, 3).map((step, i) => {
            const cfg = getAgentCfg(step.agentName);
            return (
              <div
                key={i}
                className={clsx(
                  "w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-white text-[7px] font-bold shadow-sm",
                  cfg.dot,
                )}
              >
                {cfg.letter}
              </div>
            );
          })}
        </div>
        <span className="text-xs font-semibold text-gray-600">Agent Pipeline</span>
        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">
          {steps.length} agents · เสร็จแล้ว
        </span>
        <span className="ml-auto text-gray-400 shrink-0">
          {expanded ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pt-2.5 pb-2">
          {steps.map((step, i) => (
            <DoneStepCard
              key={`${messageId}-${i}`}
              step={step}
              isLast={i === steps.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
