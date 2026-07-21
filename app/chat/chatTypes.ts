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
  pdf_url?: string | null;
};

// สถานะรายแหล่งข้อมูล ณ ตอนที่บันทึก — ใช้กู้คืน badge ใน RightPane หลัง reload
export type ReportSourceSaved = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  message?: string;
};

// หัวข้อรายงานใน wizard ขั้นที่ 2 — ผู้ใช้ปรับแก้ (เลือก/ไม่เลือก, แก้ชื่อ/คำอธิบาย,
// เพิ่ม/ลบ, จัดลำดับ) ได้ก่อนกดสร้างรายงานฉบับจริง
export type WizardTopicSaved = { id: string; title: string; desc: string; checked: boolean };

// ความคืบหน้าของ wizard ขั้นที่ 2 — บันทึกไว้เพื่อกู้คืนได้หลัง reload กลางทาง
// (เดิมถ้า reload ระหว่างแก้ไขหัวข้อ ต้องเริ่ม gen หัวข้อใหม่ทั้งหมด เสียงานที่แก้ไว้)
export type WizardProgressSaved = {
  docType: string;
  topics: WizardTopicSaved[];
  notes: Record<string, string>;
};

// รายงานที่ auto-save ลง journal_reports สำเร็จแล้ว 1 ฉบับ — เก็บทั้ง id (ไว้ fetch
// html_content ตอนกดเปิด) และ title (ไว้ตั้งเป็นชื่อปุ่มโดยตรง แทนป้าย "เปิดหน้า HTML"
// เดิมที่ไม่บอกว่าเป็นรายงานเรื่องอะไร)
export type SavedReportRef = { id: string; title: string };

// ข้อมูลดิบจากโหมด "สร้างรายงาน" (report-gather) — บันทึกลง DB พร้อมข้อความแชท
// เพื่อกู้คืนเนื้อหา "ข้อมูลพื้นฐาน" ใน RightPane ได้หลัง reload หน้า (เดิมอยู่แค่ใน
// memory ฝั่ง browser เท่านั้น พอ reload แล้วหายหมดต้องรวบรวมใหม่ทั้งหมด)
export type ReportGatherData = {
  combinedText: string;
  articlesText: string;
  articleCount: number;
  query: string;
  sources: ReportSourceSaved[];
  wizardProgress?: WizardProgressSaved;
  // รายงานทั้งหมดที่เคย auto-save ไว้จากข้อความนี้ (ปกติ 1 ฉบับ แต่ถ้าผู้ใช้แก้ไข
  // หัวข้อแล้วกด "สร้างรายงาน →" ซ้ำ จะได้เอกสารฉบับใหม่เพิ่มเข้ามาต่อท้าย ไม่ทับของเดิม)
  // — เก็บไว้ให้ขึ้นปุ่มชื่อรายงานให้กดเปิดได้ทันทีแม้ reload หน้าไปแล้ว
  savedReports?: SavedReportRef[];
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
  reportData?: ReportGatherData;
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
