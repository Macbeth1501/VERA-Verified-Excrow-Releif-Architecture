import { findUserById } from "@/lib/auth/users";
import { readSessionCookie, verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

/**
 * GET /api/v1/auth/session: who the shared session cookie says is signed in, without touching the
 * chain (unlike /auth/me, which also reads a balance). The navigation bar polls this to notice
 * when another window in the same browser signed in as someone else. Signed out is a normal 200
 * with `user: null`, not an error, so polling never fills the console with 401s. The role comes
 * from the database, never from the token.
 */
export async function GET(request: Request) {
  const headers = { "cache-control": "no-store" };
  const session = await verifySession(readSessionCookie(request));
  const user = session ? findUserById(getDb(), session.userId) : null;
  return Response.json({ user: user ? { id: user.id, email: user.email, role: user.role } : null }, { headers });
}
