import { NextRequest, NextResponse } from "next/server";
import { requireAuth, internalHeaders, PYTHON_API_URL } from "@/lib/internalFetch";

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { path } = await params;
  const url = `${PYTHON_API_URL}/api/obsidian/${path.join("/")}${req.nextUrl.search}`;
  try {
    const resp = await fetch(url, { headers: internalHeaders() });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { path } = await params;
  const isStream = path.at(-1) === "stream";
  const url = `${PYTHON_API_URL}/api/obsidian/${path.join("/")}${req.nextUrl.search}`;

  try {
    const body = await req.text();
    const ct = req.headers.get("content-type") ?? "application/json";
    const resp = await fetch(url, {
      method: "POST",
      body,
      headers: internalHeaders({ "Content-Type": ct }),
    });

    if (isStream) {
      return new NextResponse(resp.body, {
        status: resp.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
