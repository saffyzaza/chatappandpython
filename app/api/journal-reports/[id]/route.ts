import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import type { ChatSessionMessage } from "@/app/chat/chatTypes";

async function getUser(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ลบปุ่มรายงานที่ชี้ไป report id นี้ออกจากทุก session ของ user คนเดียวกัน — กันปุ่มค้าง
// ชี้ไปรายงานที่ลบไปแล้ว (กดแล้วเงียบ ไม่มีอะไรเกิดขึ้น เพราะ fetch คืน 404) ทำให้ผู้ใช้งง
async function pruneDeletedReportFromSessions(reportId: string, userId: string) {
  const { rows } = await pool.query<{ session_id: string; messages_json: ChatSessionMessage[] }>(
    `SELECT session_id, messages_json FROM chat_sessions
     WHERE user_id = $1 AND messages_json::text LIKE '%' || $2 || '%'`,
    [userId, reportId],
  );

  for (const row of rows) {
    let changed = false;
    const nextMessages = row.messages_json.map((msg) => {
      const savedReports = msg.reportData?.savedReports;
      if (!savedReports?.some((r) => r.id === reportId)) return msg;
      changed = true;
      return {
        ...msg,
        reportData: { ...msg.reportData!, savedReports: savedReports.filter((r) => r.id !== reportId) },
      };
    });
    if (!changed) continue;
    await pool.query(
      `UPDATE chat_sessions SET messages_json = $1 WHERE session_id = $2 AND user_id = $3`,
      [JSON.stringify(nextMessages), row.session_id, userId],
    );
  }
}

// ── GET /api/journal-reports/[id]  (full report with HTML) ────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const { id } = await params;
  const { rows } = await pool.query(
    `SELECT id, title, query, doc_type, article_count, topic_plan, html_content, created_at
     FROM journal_reports
     WHERE id = $1 AND user_id = $2`,
    [id, user.userId],
  );
  if (!rows[0]) return NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 });
  return NextResponse.json({ report: rows[0] });
}

// ── DELETE /api/journal-reports/[id] ─────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const { id } = await params;
  const { rowCount } = await pool.query(
    "DELETE FROM journal_reports WHERE id = $1 AND user_id = $2",
    [id, user.userId],
  );
  if (!rowCount) return NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 });

  await pruneDeletedReportFromSessions(id, user.userId);

  return NextResponse.json({ ok: true });
}
