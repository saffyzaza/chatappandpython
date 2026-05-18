import orchestrator from "./orchestrator";
import researchAgent from "./researchAgent";
import synthesizer from "./synthesizer";
import { DOMAIN_AGENTS } from "./domains";

export type { Agent, Task, Crew, TaskOutput, CrewOutput, AgentVisual, ToolDefinition } from "./types";
export { DOMAIN_AGENTS, DOMAIN_LIST } from "./domains";

export const CORE_AGENTS = { orchestrator, researchAgent, synthesizer };

// All agents (core + domains) — used by agentConfig for visual lookup
export const AGENT_MAP = {
  ...Object.fromEntries(Object.values(CORE_AGENTS).map((a) => [a.name, a])),
  ...DOMAIN_AGENTS,
};

// Default 3-slot pipeline (before crew_plan tells us the actual domain agent)
export const PIPELINE_AGENTS = [
  { name: orchestrator.name, role: orchestrator.role },
  { name: "Domain Expert",   role: "ผู้เชี่ยวชาญเฉพาะด้าน" },
  { name: synthesizer.name,  role: synthesizer.role },
];

export { orchestrator, researchAgent, synthesizer };
