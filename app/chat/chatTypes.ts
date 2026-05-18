export type ChatMessageRole = "user" | "ai";

export type AgentTool = {
  name: string;
  displayName: string;
  input: string;
  output: string;
};

export type AgentStepStatus = "pending" | "running" | "done";

export type AgentStep = {
  agentName: string;
  agentRole: string;
  thinking: string;
  tool?: AgentTool | null;
  result: string;
  status?: AgentStepStatus;
};

export type ChatSessionMessage = {
  id: string;
  role: ChatMessageRole;
  text: string;
  timestamp: string;
  agentSteps?: AgentStep[];
};

export type ChatSessionState = {
  sessionId: string;
  status: "idle" | "running" | "completed" | "failed";
  messages: ChatSessionMessage[];
  lastUserPrompt?: string;
  error?: string;
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
