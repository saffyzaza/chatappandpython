"use client";
import { useState, useEffect } from "react";
import clsx from "clsx";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import type { AgentStep } from "@/app/chat/chatTypes";
import { getAgentCfg } from "./agentConfig";
import { AgentIcon } from "./AgentIcon";
import { ToolCard } from "../tool/ToolCard";

type Props = {
  agentName: string;
  agentRole: string;
  step?: AgentStep;
  isLast: boolean;
};

export function LiveStepCard({ agentName, agentRole, step, isLast }: Props) {
  const status = step?.status ?? "pending";
  const cfg = getAgentCfg(agentName);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status === "done") setOpen(true);
  }, [status]);

  return (
    <div className="relative">
      {!isLast && (
        <div className={clsx(
          "absolute left-[9px] top-6 bottom-0 w-px z-0",
          status === "pending" ? "bg-gray-100" : "bg-gray-200",
        )} />
      )}

      <div className="relative z-10 flex gap-2.5">
        {status === "pending" && (
          <div className="w-[19px] h-[19px] rounded-full border-2 border-gray-200 bg-white shrink-0 mt-0.5" />
        )}
        {status === "running" && (
          <div className={clsx(
            "w-[19px] h-[19px] rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 border-white shadow-sm text-white animate-pulse",
            cfg.dot,
          )}>
            <AgentIcon name={agentName} />
          </div>
        )}
        {status === "done" && (
          <div className={clsx(
            "w-[19px] h-[19px] rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 border-white shadow-sm text-white",
            cfg.dot,
          )}>
            <AgentIcon name={agentName} />
          </div>
        )}

        <div className="flex-1 min-w-0 pb-1">
          <button
            onClick={() => status === "done" && setOpen((v) => !v)}
            disabled={status !== "done"}
            className={clsx(
              "flex items-center gap-2 w-full text-left py-0.5",
              status === "done" ? "cursor-pointer group" : "cursor-default",
            )}
          >
            <span className={clsx(
              "text-xs font-semibold leading-none",
              status === "pending" ? "text-gray-300" : cfg.color,
            )}>
              {agentName}
            </span>
            <span className={clsx(
              "text-[10px] leading-none",
              status === "pending" ? "text-gray-200" : "text-gray-400",
            )}>
              {agentRole}
            </span>

            {status === "running" && (
              <span className="ml-auto flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-amber-500 font-medium">กำลังทำงาน</span>
                <div className="flex gap-0.5">
                  {[0, 100, 200].map((d) => (
                    <div key={d} className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </span>
            )}
            {status === "done" && (
              <span className="ml-auto flex items-center gap-1 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0">
                <span className="text-[10px] text-emerald-500 font-bold">✓</span>
                {open ? <FiChevronDown size={11} /> : <FiChevronRight size={11} />}
              </span>
            )}
          </button>

          {status === "done" && !open && step?.result && (
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{step.result}</p>
          )}

          {status === "running" && (
            <div className="mt-1.5 h-1 bg-amber-100 rounded-full overflow-hidden">
              <div className="h-full w-3/5 bg-amber-300 rounded-full animate-pulse" />
            </div>
          )}

          {status === "done" && open && step && (
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
