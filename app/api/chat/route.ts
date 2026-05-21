const PYTHON_API = process.env.PYTHON_API_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  const body = await req.json() as {
    mode?: string;
    sessionId?: string;
    prompt?: string;
    doc_type?: string;
    [key: string]: unknown;
  };

  let upstreamUrl: string;
  let upstreamBody: unknown;

  if (body.mode === "thaijo") {
    upstreamUrl = `${PYTHON_API}/api/thaijo`;
    upstreamBody = {
      sessionId: body.sessionId ?? "",
      prompt:    body.prompt ?? "",
      doc_type:  body.doc_type ?? "policy",
    };
  } else {
    upstreamUrl = `${PYTHON_API}/api/analyze`;
    upstreamBody = body;
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
      "Content-Type":    "text/event-stream",
      "Cache-Control":   "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
