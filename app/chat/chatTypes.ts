export type ChatMessageRole = "user" | "ai";

export type AgentTool = {
  name: string;
  displayName: string;
  input: string;
  output: string;
};

export type AgentStepStatus = "pending" | "running" | "done";

export type AgentStep = {
  step?: string;        // e.g. "router" | "reasoning" | "file_finder" | "schema" | "code_gen" | "executor" | "insight"
  agentName: string;
  agentRole?: string;
  thinking?: string;
  tool?: AgentTool | null;
  code?: string;        // generated Python code (executor step)
  result: string;
  status?: AgentStepStatus;
};

export type SourceFile = {
  id: string;           // MinIO object ID (6-digit)
  name: string;         // original filename
};

export type ObsidianNoteRef = {
  note_id: string;
  title: string;
  province?: string;
  district?: string;
};

export type ChatSessionMessage = {
  id: string;
  role: ChatMessageRole;
  text: string;
  timestamp: string;
  agentSteps?: AgentStep[];
  sourceFile?: SourceFile;
  notesReferenced?: ObsidianNoteRef[];
  followUps?: string[];
};

export type ChatSessionState = {
  sessionId: string;
  status: "idle" | "running" | "completed" | "failed";
  messages: ChatSessionMessage[];
  lastUserPrompt?: string;
  error?: string;
  startedAt?: number; // Unix ms — set when request starts, used for elapsed timer
};

export type ChatRouteRequest = {
  sessionId: string;
  prompt: string;
  history: ChatSessionMessage[];
};

export type ChatRouteResponse = {
  message: string;
  agentSteps?: AgentStep[];
};
