/**
 * Saved-Report Persist — บันทึก id+title ของ journal_reports ที่ auto-save สำเร็จ
 * แล้ว ลงในข้อความแชทที่มี reportData (แบบเดียวกับ wizardPersist.ts) เพื่อให้ปุ่ม
 * เปิดรายงาน (ตั้งชื่อตามชื่อไฟล์จริง) ในแชทเก่ายังกดดูรายงานที่เคยสร้างไว้ได้ทันที
 * หลัง reload — ไม่ต้องพึ่ง thaijoStore (in-memory ล้วน ๆ รีเซ็ตทุกครั้งที่ reload หน้า)
 */
import { getChatSessionState, saveChatSessionState } from "./chatSessionStore";
import type { SavedReportRef } from "./chatTypes";

export async function addSavedReport(sessionId: string, report: SavedReportRef): Promise<void> {
  const state = getChatSessionState(sessionId);
  const idx = [...state.messages].reverse().findIndex((m) => m.reportData);
  if (idx === -1) return;
  const realIdx = state.messages.length - 1 - idx;
  const target = state.messages[realIdx];
  if (!target.reportData) return;

  // กันซ้ำ: ถ้า id นี้เคยบันทึกไว้แล้ว (เช่น auto-save ยิงซ้ำ) ให้แทนที่ตัวเดิมแทน
  // การเพิ่มซ้ำ ส่วนฉบับใหม่จริง ๆ (id ต่างกัน จากการกด "สร้างรายงาน →" ซ้ำ) จะถูก
  // ต่อท้ายเข้าไปในลิสต์ ให้ขึ้นเป็นปุ่มแยกอีกอันหนึ่ง
  const nextSavedReports = [
    ...(target.reportData.savedReports ?? []).filter((r) => r.id !== report.id),
    report,
  ];

  const nextMessages = [...state.messages];
  nextMessages[realIdx] = {
    ...target,
    reportData: { ...target.reportData, savedReports: nextSavedReports },
  };
  const nextState = { ...state, messages: nextMessages };
  saveChatSessionState(sessionId, nextState);

  try {
    await fetch("/api/chat/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, state: nextState }),
    });
  } catch { /* best-effort — UI ยังทำงานถูกต้องแม้บันทึกไม่สำเร็จ */ }
}
