import type { AgentStep } from "./chatTypes";

export type PlannedAgent = { name: string; role: string };

const STREAMING_EVENT = "streaming-state-updated";
const streamingMap = new Map<string, AgentStep[]>();
const plannedAgentsMap = new Map<string, PlannedAgent[]>();

function dispatch(sessionId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STREAMING_EVENT, { detail: { sessionId } }));
}

// ─── Streaming steps ──────────────────────────────────────────────────────────

export function getStreamingSteps(sessionId: string): AgentStep[] | null {
  return streamingMap.get(sessionId) ?? null;
}

export function setStreamingSteps(sessionId: string, steps: AgentStep[]) {
  if (typeof window === "undefined") return;
  streamingMap.set(sessionId, steps);
  dispatch(sessionId);
}

export function clearStreamingState(sessionId: string) {
  if (typeof window === "undefined") return;
  streamingMap.delete(sessionId);
  plannedAgentsMap.delete(sessionId);
  dispatch(sessionId);
}

// ─── Planned agents (set by crew_plan event) ──────────────────────────────────

export function getPlannedAgents(sessionId: string): PlannedAgent[] | null {
  return plannedAgentsMap.get(sessionId) ?? null;
}

export function setPlannedAgents(sessionId: string, agents: PlannedAgent[]) {
  if (typeof window === "undefined") return;
  plannedAgentsMap.set(sessionId, agents);
  dispatch(sessionId);
}

// ─── Subscription (shared for both steps + planned agents) ───────────────────

export function subscribeToStreamingState(sessionId: string | null, onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ sessionId?: string }>).detail;
    if (!sessionId || detail?.sessionId === sessionId) onChange();
  };
  window.addEventListener(STREAMING_EVENT, handler);
  return () => window.removeEventListener(STREAMING_EVENT, handler);
}
