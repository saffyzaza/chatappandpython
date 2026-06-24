const PYTHON_API = process.env.PYTHON_API_URL ?? "http://localhost:8000";

type ChatBody = {
  mode?: string;
  sessionId?: string;
  prompt?: string;
  doc_type?: string;
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
};

export async function POST(req: Request) {
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
    // normal / stats / obsidian / multi → /api/analyze
    upstreamUrl = `${PYTHON_API}/api/analyze`;
    upstreamBody = {
      sessionId: body.sessionId ?? "",
      prompt:    body.prompt ?? "",
      history:   body.history ?? [],
      mode,
      tools:     body.tools ?? [],
    };
  }

  const upstream = await fetch(upstreamUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(upstreamBody),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: err }), { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
