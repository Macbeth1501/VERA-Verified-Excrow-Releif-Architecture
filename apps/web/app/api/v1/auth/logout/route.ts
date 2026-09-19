import { clearSessionCookieHeader } from "@/lib/auth/session";

/** POST /api/v1/auth/logout: clears the session cookie. */
export async function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookieHeader() } });
}
