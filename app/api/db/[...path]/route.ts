import { NextRequest, NextResponse } from "next/server";
import { requireAuth, internalHeaders, PYTHON_API_URL } from "@/lib/internalFetch";

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { path } = await params;
  const url = `${PYTHON_API_URL}/api/db/${path.join("/")}${req.nextUrl.search}`;
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
  const url = `${PYTHON_API_URL}/api/db/${path.join("/")}${req.nextUrl.search}`;
  try {
    const body = await req.text();
    const ct = req.headers.get("content-type") ?? "application/json";
    const resp = await fetch(url, {
      method: "POST",
      body,
      headers: internalHeaders({ "Content-Type": ct }),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
