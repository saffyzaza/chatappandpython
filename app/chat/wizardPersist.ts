/**
 * Wizard Progress Persist — บันทึกความคืบหน้าของ wizard ขั้นเลือก/แก้ไขหัวข้อ
 * (ขั้นที่ 2 ของ report-gather) ลง DB แบบ debounce เพื่อกู้คืนได้หลัง reload
 * กลางทาง — ไม่งั้นแก้ไขหัวข้อไปแล้วต้อง gen ใหม่ทั้งหมดถ้า refresh หน้าเผลอ
 */
import { getChatSessionState, saveChatSessionState } from "./chatSessionStore";
import type { WizardProgressSaved } from "./chatTypes";

export async function saveWizardProgress(sessionId: string, progress: WizardProgressSaved): Promise<void> {
  const state = getChatSessionState(sessionId);
  const idx = [...state.messages].reverse().findIndex((m) => m.reportData);
  if (idx === -1) return;
  const realIdx = state.messages.length - 1 - idx;
  const target = state.messages[realIdx];
  if (!target.reportData) return;

  const nextMessages = [...state.messages];
  nextMessages[realIdx] = {
    ...target,
    reportData: { ...target.reportData, wizardProgress: progress },
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
