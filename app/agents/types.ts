// ─── Visual config (UI only) ──────────────────────────────────────────────────
export type AgentVisual = {
  color: string;
  bg: string;
  border: string;
  dot: string;
  letter: string;
};

// ─── Tool definition (capability declaration) ─────────────────────────────────
export type ToolDefinition = {
  name: string;
  description: string;
};

// ─── Agent (CrewAI-style) ─────────────────────────────────────────────────────
export type Agent = {
  name: string;
  role: string;         // job title shown in UI
  goal: string;         // what the agent wants to achieve
  backstory: string;    // context that shapes the agent's behaviour
  tools: ToolDefinition[];
  visual: AgentVisual;
};

// ─── Task ─────────────────────────────────────────────────────────────────────
export type Task = {
  description: string;    // what needs to be done (may contain {query} placeholder)
  expectedOutput: string; // format / content spec for the output
  agent: Agent;
  context?: Task[];       // previous tasks whose output flows into this one
};

// ─── Crew ─────────────────────────────────────────────────────────────────────
export type Crew = {
  name: string;
  agents: Agent[];
  tasks: Task[];         // execution order = array order
  process: "sequential";
  verbose?: boolean;
};

// ─── Execution output ─────────────────────────────────────────────────────────
export type TaskOutput = {
  task: Task;
  rawOutput: string;     // full LLM response for this task
  thinking: string;      // agent's internal reasoning (parsed)
  result: string;        // clean result to show in UI
  toolName?: string;     // tool used (if any, parsed from response)
  toolInput?: string;
  toolOutput?: string;
};

export type CrewOutput = {
  finalAnswer: string;
  taskOutputs: TaskOutput[];
};
