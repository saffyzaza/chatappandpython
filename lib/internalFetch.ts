/**
 * Authenticated fetch to the Python backend.
 *
 * - Adds X-Internal-Key header so Python's InternalKeyMiddleware accepts the request
 * - Optionally verifies the caller's JWT cookie (pass req to enable)
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "./auth";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "";
const PYTHON_API_URL = process.env.PYTHON_API_URL ?? "http://localhost:8000";

export { PYTHON_API_URL };

/** Headers every call to the Python backend must include. */
export function internalHeaders(extra?: HeadersInit): HeadersInit {
  const base: Record<string, string> = {
    "x-internal-key": INTERNAL_API_KEY,
  };
  if (extra) {
    const extraObj =
      extra instanceof Headers
        ? Object.fromEntries(extra.entries())
        : (extra as Record<string, string>);
    return { ...extraObj, ...base };
  }
  return base;
}

/**
 * Verify the request's JWT cookie.
 * Returns the payload on success, or a 401 NextResponse on failure.
 */
export async function requireAuth(): Promise<
  { userId: string; email: string; role: string; name: string } | NextResponse
> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return payload;
}
