/**
 * Pre-Gather Topics Store — สะพานเชื่อมระหว่าง ChatInput (ยิง request) กับ RightPane
 * (แสดง UI ให้เลือกหัวข้อ) สำหรับขั้นตอนใหม่: เลือกหัวข้อ + ใส่หมายเหตุ "ก่อน"
 * ยิงไปรวบรวมข้อมูลจริงจาก 5 แหล่ง (แทนที่จะยิงด้วย prompt ดิบๆ ไปเลยเหมือนเดิม)
 *
 * ลำดับการทำงาน:
 *   1. ChatInput เรียก /api/thaijo-topics ด้วย articles_text="" (ยังไม่มีข้อมูลจริง
 *      ให้ AI เดาหัวข้อจากคำถามอย่างเดียว) แล้ว openPreGatherTopics(...)
 *   2. RightPane subscribe เห็นข้อมูลนี้ → โชว์หน้าจอเลือก/แก้ไขหัวข้อทันที
 *   3. ผู้ใช้กด "ยิงไปหาข้อมูล →" → RightPane เรียก confirmPreGatherTopics(...)
 *   4. ChatInput ที่ await Promise ค้างอยู่ตื่นขึ้นมา ได้ topicPlan ไปสร้าง prompt
 *      แบบเสริมหัวข้อ แล้วค่อยยิง mode=report-gather ตัวจริง
 */

export type PreGatherTopic = { id: string; title: string; desc: string; checked: boolean };
export type PreGatherState = { query: string; docType: string; topics: PreGatherTopic[] };

const UPDATED_EVENT = "pre-gather-topics-updated";
const CONFIRM_EVENT = "pre-gather-topics-confirmed";

let _state: PreGatherState | null = null;

export function openPreGatherTopics(query: string, docType: string, topics: PreGatherTopic[]): void {
  _state = { query, docType, topics };
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
}

export function clearPreGatherTopics(): void {
  _state = null;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
}

export function getPreGatherTopics(): PreGatherState | null {
  return _state;
}

export function subscribeToPreGatherTopics(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(UPDATED_EVENT, onChange);
  return () => window.removeEventListener(UPDATED_EVENT, onChange);
}

export type PreGatherConfirmDetail = { query: string; docType: string; topicPlan: string };

export function confirmPreGatherTopics(detail: PreGatherConfirmDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PreGatherConfirmDetail>(CONFIRM_EVENT, { detail }));
}

/** subscribe ครั้งเดียว (one-shot) — ใช้คู่กับ Promise ใน ChatInput */
export function subscribeToPreGatherConfirmOnce(handler: (detail: PreGatherConfirmDetail) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = (e: Event) => {
    window.removeEventListener(CONFIRM_EVENT, listener);
    handler((e as CustomEvent<PreGatherConfirmDetail>).detail);
  };
  window.addEventListener(CONFIRM_EVENT, listener);
  return () => window.removeEventListener(CONFIRM_EVENT, listener);
}
