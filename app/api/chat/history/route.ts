import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { COOKIE_NAME, verifyToken } from '@/lib/auth';
import type { ChatSessionState } from '@/app/chat/chatTypes';

let hasEnsuredChatHistoryTable = false;

async function ensureChatHistoryTable() {
  if (hasEnsuredChatHistoryTable) {
    return;
  }

  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id TEXT NOT NULL UNIQUE,
      user_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'idle',
      last_user_prompt TEXT,
      messages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE chat_sessions
      ALTER COLUMN id SET DEFAULT gen_random_uuid()
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx
    ON chat_sessions(user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS chat_sessions_updated_at_idx
    ON chat_sessions(updated_at DESC);
  `);

  hasEnsuredChatHistoryTable = true;
}

async function requireUserId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  return payload?.userId ?? null;
}

function normalizeState(sessionId: string, state: Partial<ChatSessionState> | null | undefined): ChatSessionState {
  return {
    sessionId,
    status: state?.status ?? 'idle',
    messages: Array.isArray(state?.messages) ? state.messages : [],
    ...(state?.lastUserPrompt ? { lastUserPrompt: state.lastUserPrompt } : {}),
    ...(state?.error ? { error: state.error } : {}),
  };
}

type ChatHistoryListItem = {
  sessionId: string;
  title: string;
  status: ChatSessionState['status'];
  updatedAt: string;
};

function getHistoryTitleFromMessages(messages: ChatSessionState['messages'] | null, fallback?: string | null) {
  const trimmedFallback = (fallback ?? '').trim();
  if (trimmedFallback) {
    return trimmedFallback;
  }

  if (Array.isArray(messages)) {
    const firstUser = messages.find((message) => message.role === 'user' && message.text?.trim());
    if (firstUser?.text) {
      return firstUser.text.trim();
    }
  }

  return 'แชทใหม่';
}

export async function GET(req: NextRequest) {
  try {
    await ensureChatHistoryTable();

    const userId = await requireUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const sessionId = req.nextUrl.searchParams.get('sessionId')?.trim();
    if (!sessionId) {
      const listResult = await pool.query(
        `SELECT session_id, status, last_user_prompt, messages_json, updated_at
         FROM chat_sessions
         WHERE user_id = $1
         ORDER BY updated_at DESC
         LIMIT 50`,
        [userId],
      );

      const sessions: ChatHistoryListItem[] = listResult.rows.map((row) => {
        const typedRow = row as {
          session_id: string;
          status: ChatSessionState['status'];
          last_user_prompt: string | null;
          messages_json: ChatSessionState['messages'] | null;
          updated_at: string | Date;
        };

        return {
          sessionId: typedRow.session_id,
          title: getHistoryTitleFromMessages(typedRow.messages_json, typedRow.last_user_prompt),
          status: typedRow.status,
          updatedAt: new Date(typedRow.updated_at).toISOString(),
        };
      });

      return NextResponse.json({ sessions });
    }

    const result = await pool.query(
      `SELECT session_id, status, last_user_prompt, messages_json
       FROM chat_sessions
       WHERE session_id = $1 AND user_id = $2
       LIMIT 1`,
      [sessionId, userId],
    );

    if (!result.rows.length) {
      return NextResponse.json({ state: null });
    }

    const row = result.rows[0] as {
      session_id: string;
      status: ChatSessionState['status'];
      last_user_prompt: string | null;
      messages_json: ChatSessionState['messages'] | null;
    };

    const state = normalizeState(row.session_id, {
      sessionId: row.session_id,
      status: row.status,
      lastUserPrompt: row.last_user_prompt ?? undefined,
      messages: row.messages_json ?? [],
    });

    return NextResponse.json({ state });
  } catch (error) {
    console.error('[chat/history GET]', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดประวัติแชทได้' }, { status: 500 });
  }
}

type SaveHistoryBody = {
  sessionId?: string;
  state?: Partial<ChatSessionState>;
};

export async function POST(req: NextRequest) {
  try {
    await ensureChatHistoryTable();

    const userId = await requireUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const body = (await req.json()) as SaveHistoryBody;
    const sessionId = body.sessionId?.trim();

    if (!sessionId) {
      return NextResponse.json({ error: 'ต้องระบุ sessionId' }, { status: 400 });
    }

    const normalizedState = normalizeState(sessionId, body.state);
    const messagesJson = JSON.stringify(normalizedState.messages);

    const result = await pool.query(
      `INSERT INTO chat_sessions (session_id, user_id, status, last_user_prompt, messages_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (session_id) DO UPDATE
       SET status = EXCLUDED.status,
           last_user_prompt = EXCLUDED.last_user_prompt,
           messages_json = EXCLUDED.messages_json,
           user_id = CASE
             WHEN chat_sessions.user_id IS NULL THEN EXCLUDED.user_id
             ELSE chat_sessions.user_id
           END,
           updated_at = NOW()
       WHERE chat_sessions.user_id = EXCLUDED.user_id OR chat_sessions.user_id IS NULL
       RETURNING session_id`,
      [
        sessionId,
        userId,
        normalizedState.status,
        normalizedState.lastUserPrompt ?? null,
        messagesJson,
      ],
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์แก้ไขประวัติแชทนี้' }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[chat/history POST]', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกประวัติแชทได้' }, { status: 500 });
  }
}
