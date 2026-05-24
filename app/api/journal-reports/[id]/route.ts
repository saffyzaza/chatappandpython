import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

async function getUser(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
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
  return NextResponse.json({ ok: true });
}
