import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

// ── helpers ────────────────────────────────────────────────────────────────────

async function getUser(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ── GET /api/journal-reports  (list — no html_content to keep payload small) ──

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const { rows } = await pool.query<{
    id: string; title: string; query: string; doc_type: string;
    article_count: number; topic_plan: string; created_at: string;
  }>(
    `SELECT id, title, query, doc_type, article_count, topic_plan, created_at
     FROM journal_reports
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user.userId],
  );
  return NextResponse.json({ reports: rows });
}

// ── POST /api/journal-reports  (save) ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const body = await req.json() as {
    title?: string; query?: string; doc_type?: string;
    article_count?: number; topic_plan?: string; html_content?: string;
  };

  const { title, query, doc_type, article_count, topic_plan, html_content } = body;
  if (!html_content || !query) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query<{ id: string; created_at: string }>(
      `INSERT INTO journal_reports (user_id, title, query, doc_type, article_count, topic_plan, html_content)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [
        user.userId,
        title ?? query,
        query,
        doc_type ?? "policy",
        article_count ?? 0,
        topic_plan ?? "",
        html_content,
      ],
    );
    return NextResponse.json({ id: rows[0].id, created_at: rows[0].created_at }, { status: 201 });
  } catch (err) {
    console.error("[journal-reports POST]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
