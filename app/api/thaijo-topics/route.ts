const PYTHON_API = process.env.PYTHON_API_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  const body = await req.json() as { query: string; articles_text: string; doc_type: string };
  const upstream = await fetch(`${PYTHON_API}/api/thaijo/topics`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      query:         body.query ?? "",
      articles_text: body.articles_text ?? "",
      doc_type:      body.doc_type ?? "policy",
    }),
  });
  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: err }), { status: upstream.status });
  }
  const data = await upstream.json() as unknown;
  return Response.json(data);
}
