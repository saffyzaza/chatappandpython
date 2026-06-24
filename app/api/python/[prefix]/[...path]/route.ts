import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = process.env.PYTHON_API_URL ?? "http://localhost:8000";

const ALLOWED_PREFIXES = ["accident-chat", "accident-policy", "db", "obsidian"];

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ prefix: string; path: string[] }> }
) {
  const { prefix, path } = await params;

  if (!ALLOWED_PREFIXES.includes(prefix)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const target = `${UPSTREAM}/api/${prefix}/${path.join("/")}${url.search}`;

  const init: RequestInit = { method: req.method };

  const ct = req.headers.get("content-type");
  if (ct) init.headers = { "content-type": ct };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    (init as RequestInit & { duplex: string }).duplex = "half";
  }

  const res = await fetch(target, init);

  const resHeaders = new Headers();
  ["content-type", "cache-control", "transfer-encoding"].forEach((h) => {
    const v = res.headers.get(h);
    if (v) resHeaders.set(h, v);
  });

  return new NextResponse(res.body, {
    status: res.status,
    headers: resHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
