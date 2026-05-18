export type ToolArgs = Record<string, string>;

export type ToolResult = {
  success: boolean;
  data: string;
};

// Optional AI helper passed from runner so tools can make LLM calls
export type AIHelper = (systemPrompt: string, userPrompt: string) => Promise<string>;

export type ExecutableTool = {
  name: string;
  description: string;
  // Shown in agent system prompt so the LLM knows how to call it
  usage: string;
  execute: (args: ToolArgs, appUrl: string, callAI?: AIHelper) => Promise<ToolResult>;
};
