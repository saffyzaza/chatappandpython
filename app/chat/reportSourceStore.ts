/**
 * Report Source Store — สถานะ badge รายแหล่งข้อมูล (5 แหล่ง) ระหว่างโหมด
 * "สร้างรายงาน" (report-gather) กำลังระดมข้อมูลแบบขนาน
 * ใช้ CustomEvent เพื่อ notify subscribers (เหมือน thaijoStore)
 */

export type ReportSourceStatus = "pending" | "running" | "done" | "error";

export type ReportSource = {
  id: string;
  label: string;
  status: ReportSourceStatus;
  message?: string;
};

const REPORT_SOURCE_EVENT = "report-source-status-updated";

const SOURCE_ORDER = ["obsidian", "stats", "thaijo", "pubmed", "tavily"];
const DEFAULT_LABELS: Record<string, string> = {
  obsidian: "คลังความรู้ (Obsidian)",
  stats: "สถิติ",
  thaijo: "งานวิจัยไทย (ThaiJo)",
  pubmed: "งานวิจัยสากล (PubMed)",
  tavily: "ค้นหาเว็บ (Tavily)",
};

let _sources: ReportSource[] | null = null;

// prompt/sessionId ของรอบ report-gather ปัจจุบัน — เก็บไว้ให้ปุ่ม "ลองใหม่" บน badge
// ยิง request ซ้ำเฉพาะแหล่งเดียวได้โดยไม่ต้องพึ่ง context จากที่อื่น
export type ReportContext = { prompt: string; sessionId: string };
let _context: ReportContext | null = null;

function dispatch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REPORT_SOURCE_EVENT));
}

/** เริ่มรอบใหม่ — ตั้งทั้ง 5 แหล่งเป็น pending */
export function startReportSources(prompt: string, sessionId: string): void {
  _sources = SOURCE_ORDER.map((id) => ({
    id,
    label: DEFAULT_LABELS[id],
    status: "pending" as ReportSourceStatus,
  }));
  _context = { prompt, sessionId };
  dispatch();
}

export function setReportSourceStatus(
  id: string,
  status: ReportSourceStatus,
  label?: string,
  message?: string,
): void {
  if (!_sources) return;
  const idx = _sources.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const next = [..._sources];
  // เขียนทับ message เสมอ (ไม่ใช่แค่ตอนมีค่า) — กันข้อความ error เก่าค้างอยู่หลัง
  // retry สำเร็จแล้วสถานะเปลี่ยนเป็น done/running แต่ไม่ได้ส่ง message ใหม่มา
  next[idx] = { ...next[idx], status, message, ...(label ? { label } : {}) };
  _sources = next;
  dispatch();
}

/** กู้คืน badge จากข้อมูลที่บันทึกไว้ใน DB (หลัง reload) — คงสถานะเดิมไว้ทุกอัน
 * (รวมถึง error) พร้อม context ให้ปุ่ม "ลองใหม่" ยังกดใช้งานต่อได้ */
export function restoreReportSources(sources: ReportSource[], prompt: string, sessionId: string): void {
  if (!sources || sources.length === 0) return;
  _sources = sources;
  _context = { prompt, sessionId };
  dispatch();
}

export function clearReportSources(): void {
  _sources = null;
  _context = null;
  dispatch();
}

export function getReportSources(): ReportSource[] | null {
  return _sources;
}

export function getReportContext(): ReportContext | null {
  return _context;
}

export function subscribeToReportSources(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(REPORT_SOURCE_EVENT, onChange);
  return () => window.removeEventListener(REPORT_SOURCE_EVENT, onChange);
}
