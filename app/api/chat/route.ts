import { requireAuth, internalHeaders, PYTHON_API_URL } from "@/lib/internalFetch";
import pool from "@/lib/db";

const PYTHON_API = PYTHON_API_URL;

/**
 * Consume a teed copy of the SSE stream server-side and persist the final
 * answer to chat_sessions once the pipeline finishes — even if the browser
 * tab that started the request is gone (refresh/close). Without this, only
 * the original tab's own fetch-reading loop (ChatInput.tsx) ever writes the
 * "done" status, so a client-side disconnect leaves status="running" forever
 * and the recovery polling in LeftPane.tsx never resolves.
 *
 * Guarded by `AND status = 'running'` so it never clobbers the richer result
 * the client itself already persisted when it was still connected.
 */
async function persistFallbackCompletion(
  stream: ReadableStream<Uint8Array>,
  sessionId: string,
  userId: string,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalText = "";
  let isError = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;
        let ev: Record<string, unknown>;
        try {
          ev = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        const type = ev.type as string | undefined;
        if (type === "error") {
          isError = true;
          finalText = (ev.message as string) || "เกิดข้อผิดพลาดระหว่างประมวลผล";
        } else if (type === "final" || type === "result") {
          const text =
            (ev.content as string) || (ev.message as string) ||
            (ev.textResult as string) || (ev.reportHtml as string);
          if (text) finalText = text;
        }
      }
    }
  } catch (error) {
    console.error("[chat fallback-persist] stream read error:", error);
    return;
  }

  if (!finalText) return;

  try {
    const assistantMessage = {
      id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: "assistant",
      text: finalText,
      timestamp: new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
    };

    const existing = await pool.query(
      `SELECT messages_json FROM chat_sessions WHERE session_id = $1 AND user_id = $2 AND status = 'running' LIMIT 1`,
      [sessionId, userId],
    );
    if (!existing.rows.length) return; // client already resolved it, or session isn't ours

    const messages = [...(existing.rows[0].messages_json ?? []), assistantMessage];

    await pool.query(
      `UPDATE chat_sessions
       SET status = $3, messages_json = $4::jsonb, updated_at = NOW()
       WHERE session_id = $1 AND user_id = $2 AND status = 'running'`,
      [sessionId, userId, isError ? "error" : "done", JSON.stringify(messages)],
    );
  } catch (error) {
    console.error("[chat fallback-persist] db write error:", error);
  }
}

type ChatBody = {
  mode?: string;
  sessionId?: string;
  prompt?: string;
  doc_type?: string;
  retry_source?: string;
  report_title?: string;
  tools?: string[];
  attached_files?: { id: string; name: string }[];
  [key: string]: unknown;
};

// Modes that go to a dedicated endpoint (single-tool operations)
const MODE_ENDPOINT: Record<string, string> = {
  thaijo:   "/api/thaijo",
  compare:  "/api/compare",
  report:   "/api/report",
  database: "/api/database",
  pubmed:   "/api/pubmed",
};

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const body = await req.json() as ChatBody;
  const mode = body.mode ?? "normal";

  let upstreamUrl: string;
  let upstreamBody: unknown;

  if (mode === "thaijo") {
    upstreamUrl = `${PYTHON_API}/api/thaijo`;
    upstreamBody = {
      sessionId: body.sessionId ?? "",
      prompt:    body.prompt ?? "",
      doc_type:  body.doc_type ?? "policy",
    };
  } else if (mode === "thaijo-report") {
    upstreamUrl = `${PYTHON_API}/api/thaijo/report`;
    upstreamBody = {
      sessionId:     body.sessionId ?? "",
      query:         body.query ?? "",
      articles_text: body.articles_text ?? "",
      doc_type:      body.doc_type ?? "policy",
      topic_plan:    body.topic_plan ?? "",
    };
  } else if (mode in MODE_ENDPOINT) {
    upstreamUrl = `${PYTHON_API}${MODE_ENDPOINT[mode]}`;
    upstreamBody = {
      sessionId:      body.sessionId ?? "",
      prompt:         body.prompt ?? "",
      history:        body.history ?? [],
      attached_files: body.attached_files ?? [],
      doc_type:       body.doc_type ?? "workplan",
    };
  } else {
    // normal / stats / obsidian / multi / report-gather / report-gather-retry → /api/analyze
    upstreamUrl = `${PYTHON_API}/api/analyze`;
    upstreamBody = {
      sessionId: body.sessionId ?? "",
      prompt:    body.prompt ?? "",
      history:   body.history ?? [],
      mode,
      tools:     body.tools ?? [],
      // ชนิดเอกสารที่เลือกไว้ล่วงหน้าตอนกดปุ่ม "สร้างรายงาน" (report-gather เท่านั้น) —
      // backend echo กลับใน event "final" ให้ wizard ข้ามขั้นตอนเลือกประเภทเอกสาร
      doc_type:  body.doc_type,
      // แหล่งข้อมูลเดียวที่ต้องการลองใหม่ (report-gather-retry เท่านั้น)
      retry_source: body.retry_source,
      // ชื่อเรื่องสั้นๆ ที่ผู้ใช้พิมพ์จริง แยกจาก prompt ที่อาจถูกเสริมหัวข้อจนยาว (report-gather)
      report_title: body.report_title,
    };
  }

  const upstream = await fetch(upstreamUrl, {
    method:  "POST",
    headers: internalHeaders({ "Content-Type": "application/json" }),
    body:    JSON.stringify(upstreamBody),
    signal:  AbortSignal.timeout(600_000), // 10-minute max for long AI pipelines
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: err }), { status: upstream.status });
  }

  const sessionId = body.sessionId?.trim();
  let clientStream = upstream.body;

  if (sessionId && clientStream) {
    const [forClient, forServer] = clientStream.tee();
    clientStream = forClient;
    // Fire-and-forget — must not block the response to the browser.
    void persistFallbackCompletion(forServer, sessionId, auth.userId);
  }

  return new Response(clientStream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
