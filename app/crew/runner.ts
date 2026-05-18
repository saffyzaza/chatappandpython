import type { Crew, Task, TaskOutput, CrewOutput, Agent } from "@/app/agents/types";
import { DOMAIN_AGENTS } from "@/app/agents/domains";
import { EXECUTABLE_TOOLS } from "@/app/tools";
import type { AIHelper } from "@/app/tools/types";

export type PlannedAgent = { name: string; role: string };

export type CrewEvent =
  | { type: "crew_plan"; agents: PlannedAgent[] }
  | { type: "task_start"; agent: Agent; task: Task }
  | { type: "task_done"; agent: Agent; task: Task; output: TaskOutput }
  | { type: "crew_done"; result: CrewOutput };

export type ModelConfig = {
  orchestrator: string; // Orchestrator task
  domain: string;       // Domain agent — first reasoning call
  synthesizer: string;  // Synthesizer task
  tool: string;         // ReAct loop after tool result (cheap+fast)
};

type LLMMessage = { role: "system" | "user" | "assistant"; content: string };
type LLMCaller = (systemPrompt: string, userPrompt: string, model: string, temperature?: number) => Promise<string>;
type LLMMultiTurn = (messages: LLMMessage[], model: string, temperature?: number) => Promise<string>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDomainFromOutput(output: string): string | null {
  const match = output.match(/\[DOMAIN:\s*([^\]]+)\]/i);
  return match ? match[1].trim() : null;
}

function parseToolCall(output: string): { name: string; args: Record<string, string> } | null {
  const match = output.match(/\[TOOL_CALL:\s*(\w+)\(([^)]*)\)\]/i);
  if (!match) return null;

  const toolName = match[1];
  const argsStr = match[2];
  const args: Record<string, string> = {};
  const argRegex = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = argRegex.exec(argsStr)) !== null) {
    args[m[1]] = m[2];
  }
  return { name: toolName, args };
}

function parseTaskOutput(task: Task, rawOutput: string, toolsUsed: string[]): TaskOutput {
  const clean = rawOutput
    .replace(/\[DOMAIN:[^\]]+\]/gi, "")
    .replace(/\[TOOL_CALL:[^\]]+\]/gi, "")
    .trim();

  const lines = clean.split("\n");
  const thinkingEnd = lines.findIndex(
    (l, i) => i > 0 && (l.startsWith("#") || l.startsWith("-") || l.startsWith("|")),
  );
  const thinking =
    thinkingEnd > 1
      ? lines.slice(0, thinkingEnd).join(" ").trim()
      : task.description.split("\n")[0];
  const cleanResult = thinkingEnd > 1 ? lines.slice(thinkingEnd).join("\n").trim() : clean;

  const firstTool = toolsUsed[0];
  return {
    task,
    rawOutput,
    thinking,
    result: cleanResult || clean,
    toolName:   firstTool,
    toolInput:  firstTool ? `tools used: ${toolsUsed.join(", ")}` : undefined,
    toolOutput: firstTool ? cleanResult.slice(0, 200) : undefined,
  };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildToolInstructions(agent: Agent): string {
  const executableOnes = agent.tools.filter((t) => EXECUTABLE_TOOLS[t.name]);
  if (executableOnes.length === 0) return "";

  const usageLines = executableOnes.map((t) => `  ${EXECUTABLE_TOOLS[t.name]!.usage}`).join("\n");
  return [
    "",
    "── การใช้ Tool ──",
    "เมื่อต้องการค้นหาหรืออ่านข้อมูล ให้ระบุ [TOOL_CALL: ...] บนบรรทัดแยก แล้วรอรับ Tool result",
    "ขั้นตอน:",
    "  วิธีที่ดีที่สุด (1 ขั้นตอน): find_and_analyze(query='คำถามเต็มๆ เช่น พยายามฆ่าตัวตาย จ.ยโสธร 2024 ชาย หญิง รวม')",
    "  ← AI จะหาไฟล์ที่เหมาะสมและอ่านทั้งไฟล์ให้เองโดยอัตโนมัติ",
    "",
    "  หรือแยกขั้นตอน:",
    "  ① file_finder(query='...') → ดูรายการไฟล์",
    "  ② ai_csv_analyzer(file_id='xxx', question='...') → ส่งไฟล์เต็มให้ AI อ่าน",
    "รูปแบบ:",
    usageLines,
    "หลังได้ Tool result ครบแล้วให้ตอบโดยไม่ต้องเรียก tool อีก",
    "",
    "── กฎเหล็ก (ผิดกฎ = ตอบผิด) ──",
    "❌❌❌ ห้ามแต่งตัวเลขเด็ดขาด — ทุกตัวเลขต้องมาจาก Tool result ที่เห็นจริง",
    "❌ ห้ามใช้ความรู้ทั่วไป/ความรู้นอก tool ในการตอบตัวเลข",
    "❌ ห้ามปรับ format ตัวเลข (ถ้า CSV เป็น 2 อย่าใส่ % เพิ่ม, ถ้าเป็น 1234 อย่าปัดเป็น 1.2K)",
    "❌ ห้าม interpolate หรือเดาตัวเลขปี/จังหวัดที่ไม่มี",
    "✅ ก่อนตอบตัวเลขใดๆ → ต้อง quote แถวต้นทางจาก Tool result ก่อน",
    "✅ ถ้า Tool result ไม่มีตัวเลขที่ต้องการ → ตอบ 'ไม่พบในไฟล์'",
    "✅ ระบุ SOURCE FILE จาก Tool result เสมอ",
  ].join("\n");
}

function buildSystemPrompt(agent: Agent): string {
  const toolList =
    agent.tools.length > 0
      ? agent.tools.map((t) => `  - ${t.name}: ${t.description}`).join("\n")
      : "  ไม่มีเครื่องมือเฉพาะ";

  return [
    `คุณคือ ${agent.role}`,
    "",
    `เป้าหมาย: ${agent.goal}`,
    "",
    `ประวัติย่อ:\n${agent.backstory}`,
    "",
    `เครื่องมือที่ใช้ได้:\n${toolList}`,
    buildToolInstructions(agent),
  ].join("\n");
}

function buildUserPrompt(
  task: Task,
  contextOutputs: TaskOutput[],
  inputs: Record<string, string>,
): string {
  const query = inputs.query ?? "";
  const contextText =
    contextOutputs.length > 0
      ? contextOutputs
          .map((co) => `### ${co.task.agent.name}\n${co.result}`)
          .join("\n\n")
      : "";

  return [
    `งานของคุณ:\n${task.description.replace(/\{query\}/g, query)}`,
    "",
    `ผลลัพธ์ที่ต้องการ:\n${task.expectedOutput}`,
    contextText ? `\nบริบทจาก agents ก่อนหน้า:\n${contextText}` : "",
    "",
    `คำถามของผู้ใช้: ${query}`,
    "",
    "ตอบเฉพาะผลลัพธ์ของงาน ไม่ต้องอธิบายว่าจะทำอะไร",
  ]
    .filter(Boolean)
    .join("\n");
}

// ─── ReAct execution loop (Reason → Act → Observe → repeat) ──────────────────

function getTempForAgent(agentName: string): number {
  if (agentName === "Synthesizer") return 0.3;
  return 0.1; // Orchestrator, domain agents, tool ReAct
}

function getAgentModel(agentName: string, models: ModelConfig): string {
  if (agentName === "Orchestrator") return models.orchestrator;
  if (agentName === "Synthesizer")  return models.synthesizer;
  return models.domain;
}

async function executeWithTools(
  agent: Agent,
  systemPrompt: string,
  initialUserPrompt: string,
  callMultiTurn: LLMMultiTurn,
  appUrl: string,
  models: ModelConfig,
  toolAI: AIHelper,
  maxIterations = 8,
): Promise<{ rawOutput: string; toolsUsed: string[] }> {
  const agentModel = getAgentModel(agent.name, models);

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: initialUserPrompt },
  ];

  const toolsUsed: string[] = [];
  let lastOutput = "";
  let isFirstCall = true;

  for (let i = 0; i < maxIterations; i++) {
    const model = isFirstCall ? agentModel : models.tool;
    const temp = getTempForAgent(agent.name);
    isFirstCall = false;
    lastOutput = await callMultiTurn(messages, model, temp);

    const toolCall = parseToolCall(lastOutput);
    if (!toolCall) break; // No tool call → agent is done

    const tool = EXECUTABLE_TOOLS[toolCall.name];
    if (!tool) {
      // Unknown tool — stop
      messages.push({ role: "assistant", content: lastOutput });
      messages.push({
        role: "user",
        content: `Tool "${toolCall.name}" ไม่พบในระบบ ให้ตอบโดยใช้ความรู้ที่มีอยู่แทน`,
      });
      continue;
    }

    // Execute the real tool — toolAI is injected from runCrew scope
    const result = await tool.execute(toolCall.args, appUrl, toolAI);
    toolsUsed.push(toolCall.name);

    // Feed result back into conversation
    messages.push({ role: "assistant", content: lastOutput });
    messages.push({
      role: "user",
      content: `Tool result (${toolCall.name}):\n${result.data}\n\nให้ดำเนินการต่อ หรือตอบคำถามถ้าได้ข้อมูลครบแล้ว`,
    });
  }

  return { rawOutput: lastOutput, toolsUsed };
}

// ─── Crew runner ──────────────────────────────────────────────────────────────

export async function* runCrew(
  crew: Crew,
  inputs: Record<string, string>,
  callLLM: LLMCaller,
  appUrl: string,
  models: ModelConfig,
): AsyncGenerator<CrewEvent> {
  const completedOutputs = new Map<Task, TaskOutput>();
  let dynamicTasks: Task[] = [...crew.tasks];
  let planSent = false;

  // Wrap callLLM for multi-turn (ReAct loop) — model + temperature per call
  const callMultiTurn: LLMMultiTurn = async (messages, model, temperature) => {
    const sys = messages.find((m) => m.role === "system")?.content ?? "";
    const userMsgs = messages.filter((m) => m.role !== "system");
    const combined = userMsgs
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join("\n\n---\n\n");
    return callLLM(sys, combined, model, temperature);
  };

  // AI helper for tools (cheap/fast model, low temp for data tasks)
  const toolAI: AIHelper = (sys, usr) => callLLM(sys, usr, models.tool, 0.1);

  for (let taskIndex = 0; taskIndex < dynamicTasks.length; taskIndex++) {
    const task = dynamicTasks[taskIndex];

    const contextOutputs = (task.context ?? [])
      .map((dep) => {
        for (const [ct, out] of completedOutputs) {
          if (ct.description === dep.description) return out;
        }
        return undefined;
      })
      .filter(Boolean) as TaskOutput[];

    // After Orchestrator completes: resolve domain agent + emit crew_plan
    if (taskIndex === 1 && !planSent) {
      const orchOutput = Array.from(completedOutputs.values())[0];
      const domainKey = orchOutput ? parseDomainFromOutput(orchOutput.rawOutput) : null;
      const domainAgent = domainKey ? DOMAIN_AGENTS[domainKey] : null;

      if (domainAgent) {
        dynamicTasks = dynamicTasks.map((t, i) =>
          i === 1 ? { ...t, agent: domainAgent } : t,
        );
      }

      yield {
        type: "crew_plan",
        agents: dynamicTasks.map((t) => ({ name: t.agent.name, role: t.agent.role })),
      };
      planSent = true;
    }

    const currentTask = dynamicTasks[taskIndex];
    yield { type: "task_start", agent: currentTask.agent, task: currentTask };

    const systemPrompt = buildSystemPrompt(currentTask.agent);
    const userPrompt = buildUserPrompt(currentTask, contextOutputs, inputs);

    const { rawOutput, toolsUsed } = await executeWithTools(
      currentTask.agent,
      systemPrompt,
      userPrompt,
      callMultiTurn,
      appUrl,
      models,
      toolAI,
    );

    const taskOutput = parseTaskOutput(currentTask, rawOutput, toolsUsed);
    completedOutputs.set(currentTask, taskOutput);

    yield { type: "task_done", agent: currentTask.agent, task: currentTask, output: taskOutput };
  }

  const lastTask = dynamicTasks[dynamicTasks.length - 1];
  const lastOutput = completedOutputs.get(lastTask);

  yield {
    type: "crew_done",
    result: {
      finalAnswer: lastOutput?.result ?? "",
      taskOutputs: Array.from(completedOutputs.values()),
    },
  };
}
