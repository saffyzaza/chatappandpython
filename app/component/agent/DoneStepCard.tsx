"use client";
import { useState } from "react";
import clsx from "clsx";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import type { AgentStep } from "@/app/chat/chatTypes";
import { getAgentCfg } from "./agentConfig";
import { AgentIcon } from "./AgentIcon";
import { ToolCard } from "../tool/ToolCard";

type Props = { step: AgentStep; isLast: boolean };

export function DoneStepCard({ step, isLast }: Props) {
  const [open, setOpen] = useState(false);
  const cfg = getAgentCfg(step.agentName);

  return (
    <div className="relative">
      {!isLast && <div className="absolute left-[9px] top-6 bottom-0 w-px bg-gray-200 z-0" />}

      <div className="relative z-10 flex gap-2.5">
        <div className={clsx(
          "w-[19px] h-[19px] rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 border-white shadow-sm text-white",
          cfg.dot,
        )}>
          <AgentIcon name={step.agentName} />
        </div>

        <div className="flex-1 min-w-0 pb-1">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 w-full text-left group py-0.5"
          >
            <span className={clsx("text-xs font-semibold leading-none", cfg.color)}>
              {step.agentName}
            </span>
            <span className="text-[10px] text-gray-400 leading-none">{step.agentRole}</span>
            <span className="ml-auto text-gray-300 group-hover:text-gray-500 transition-colors shrink-0">
              {open ? <FiChevronDown size={11} /> : <FiChevronRight size={11} />}
            </span>
          </button>

          {!open && step.result && (
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{step.result}</p>
          )}

          {open && (
            <div className="mt-1.5 space-y-1.5">
              {step.thinking && (
                <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                  <div className="text-[10px] font-medium text-gray-400 mb-1 flex items-center gap-1">
                    <span>💭</span><span>ความคิด</span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">{step.thinking}</p>
                </div>
              )}
              <ToolCard step={step} cfg={cfg} />
              {step.result && (
                <div className="flex items-start gap-1.5">
                  <span className="text-emerald-500 text-xs shrink-0 mt-0.5 font-bold">✓</span>
                  <p className="text-[11px] text-gray-600 leading-relaxed">{step.result}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!isLast && <div className="h-2.5" />}
    </div>
  );
}
