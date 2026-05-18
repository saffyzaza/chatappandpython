import { AGENT_MAP, PIPELINE_AGENTS } from "@/app/agents";
import type { AgentVisual } from "@/app/agents/types";

// Re-export for components that need the pipeline slot list
export { PIPELINE_AGENTS };

// AgentCfg is the same shape as AgentVisual — alias for backward compat
export type AgentCfg = AgentVisual;

export const DEFAULT_CFG: AgentCfg = {
  color:  "text-gray-700",
  bg:     "bg-gray-50",
  border: "border-gray-200",
  dot:    "bg-gray-400",
  letter: "?",
};

export function getAgentCfg(name: string): AgentCfg {
  return AGENT_MAP[name]?.visual ?? DEFAULT_CFG;
}

// Derived lookup table for components that use it directly
export const AGENT_CONFIG: Record<string, AgentCfg> = Object.fromEntries(
  Object.entries(AGENT_MAP).map(([name, def]) => [name, def.visual]),
);
