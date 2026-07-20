/**
 * Report Ready Store — สะพานเชื่อมระหว่าง ChatInput (รวบรวมข้อมูลเสร็จ) กับ RightPane
 * (แสดงปุ่มให้ผู้ใช้ตรวจสอบข้อมูลพื้นฐานก่อน แล้วค่อยกดเริ่มสร้างเอกสาร HTML)
 *
 * ต่างจากเดิม (auto-generate ทันทีที่ gather เสร็จ) — ตอนนี้แค่ "พร้อมให้กด" เท่านั้น
 * ผู้ใช้ต้องตรวจสอบเนื้อหาที่รวบรวมมาก่อน แล้วกดปุ่มเองถึงจะเริ่ม generate HTML จริง
 */

export type ReportReadyState = { docType: string; topicPlan: string } | null;

const EVENT = "report-ready-updated";
let _state: ReportReadyState = null;

export function setReportReady(v: ReportReadyState): void {
  _state = v;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT));
}

export function clearReportReady(): void {
  setReportReady(null);
}

export function getReportReady(): ReportReadyState {
  return _state;
}

export function subscribeToReportReady(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
