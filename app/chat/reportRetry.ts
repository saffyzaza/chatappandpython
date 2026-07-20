/**
 * Report Source Retry — ปุ่ม "ลองใหม่" บน badge ที่ status=error ในโหมด "สร้างรายงาน"
 * ยิง mode=report-gather-retry ไปที่แหล่งเดียว แล้วต่อเนื้อหาที่ได้เข้ากับ RightPane
 * เดิม (ไม่ต้องรัน gather ใหม่ทั้ง 5 แหล่ง)
 */
import { getReportContext, setReportSourceStatus, getReportSources } from "./reportSourceStore";
import type { ReportSourceStatus } from "./reportSourceStore";
import { appendThaijoTextChunk, appendThaijoSearchArticles } from "./thaijoStore";
import { getChatSessionState, saveChatSessionState } from "./chatSessionStore";

/** บันทึกผลลัพธ์ retry ทับข้อความล่าสุดที่มี reportData ลง DB — ไม่งั้นเนื้อหาที่กู้
 * กลับมาได้จะอยู่แค่ใน memory เหมือนเดิม พอ reload อีกรอบก็หายอีก */
async function persistRetryResult(sessionId: string, appendedText: string, appendedArticles: string, appendedArticleCount: number): Promise<void> {
  const state = getChatSessionState(sessionId);
  const idx = [...state.messages].reverse().findIndex((m) => m.reportData);
  if (idx === -1) return;
  const realIdx = state.messages.length - 1 - idx;
  const target = state.messages[realIdx];
  if (!target.reportData) return;

  const nextMessages = [...state.messages];
  nextMessages[realIdx] = {
    ...target,
    reportData: {
      ...target.reportData,
      combinedText: appendedText ? `${target.reportData.combinedText}\n\n---\n\n${appendedText}` : target.reportData.combinedText,
      articlesText: appendedArticles ? `${target.reportData.articlesText}\n\n${appendedArticles}` : target.reportData.articlesText,
      articleCount: target.reportData.articleCount + appendedArticleCount,
      sources: getReportSources() ?? target.reportData.sources,
    },
  };
  const nextState = { ...state, messages: nextMessages };
  saveChatSessionState(sessionId, nextState);

  try {
    await fetch("/api/chat/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, state: nextState }),
    });
  } catch { /* best-effort — badge ยังอัปเดตถูกต้องใน UI แม้บันทึกไม่สำเร็จ */ }
}

export async function retryReportSource(source: string): Promise<void> {
  const ctx = getReportContext();
  if (!ctx) return;

  setReportSourceStatus(source, "running");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "report-gather-retry",
        sessionId: ctx.sessionId,
        prompt: ctx.prompt,
        retry_source: source,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sectionText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;

        let event: { type: string; [key: string]: unknown };
        try {
            event = JSON.parse(line.slice(6)) as { type: string; [key: string]: unknown };
        } catch { continue; }

        if (event.type === "report_source_status") {
          setReportSourceStatus(
            event.source as string,
            event.status as ReportSourceStatus,
            event.label as string | undefined,
            event.message as string | undefined,
          );
        } else if (event.type === "text_chunk") {
          sectionText += (event.text as string) ?? "";
        } else if (event.type === "final") {
          const text = sectionText || (event.textResult as string) || "";
          if (text) appendThaijoTextChunk(`\n\n---\n\n${text}`);
          const articlesText = (event.articlesText as string) ?? "";
          const articleCount = (event.articleCount as number) ?? 0;
          if (articlesText) {
            appendThaijoSearchArticles(articlesText, articleCount);
          }
          void persistRetryResult(ctx.sessionId, text, articlesText, articleCount);
        } else if (event.type === "error") {
          setReportSourceStatus(source, "error", undefined, (event.message as string) ?? "ลองใหม่ไม่สำเร็จ");
        }
      }
    }
  } catch (err) {
    setReportSourceStatus(source, "error", undefined, err instanceof Error ? err.message : "ลองใหม่ไม่สำเร็จ");
  }
}
