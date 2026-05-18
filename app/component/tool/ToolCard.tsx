"use client";
import clsx from "clsx";
import { FiTool } from "react-icons/fi";
import type { AgentStep } from "@/app/chat/chatTypes";
import type { AgentCfg } from "@/app/component/agent/agentConfig";
import { TOOL_ICONS } from "./toolConfig";

type Props = { step: AgentStep; cfg: AgentCfg };

export function ToolCard({ step, cfg }: Props) {
  if (!step.tool) return null;
  return (
    <div className={clsx("rounded-lg p-2 border", cfg.bg, cfg.border)}>
      <div className={clsx("text-[10px] font-semibold mb-1.5 flex items-center gap-1.5", cfg.color)}>
        <FiTool size={9} />
        <span>{TOOL_ICONS[step.tool.name] ?? "🔧"} {step.tool.displayName}</span>
      </div>
      <div className="space-y-1">
        <div>
          <span className="text-[9px] uppercase tracking-wide text-gray-400 font-medium">Input</span>
          <p className="text-[11px] text-gray-600 bg-white/80 rounded px-1.5 py-0.5 mt-0.5 leading-relaxed">
            {step.tool.input}
          </p>
        </div>
        <div>
          <span className="text-[9px] uppercase tracking-wide text-gray-400 font-medium">Output</span>
          <p className="text-[11px] text-gray-600 bg-white/80 rounded px-1.5 py-0.5 mt-0.5 leading-relaxed">
            {step.tool.output}
          </p>
        </div>
      </div>
    </div>
  );
}
