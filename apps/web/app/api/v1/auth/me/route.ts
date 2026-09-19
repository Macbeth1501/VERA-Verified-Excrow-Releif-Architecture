import { apiError } from "@/lib/api/errors";
import { getMinrBalance } from "@/lib/chain/balance";
import { findUserById } from "@/lib/auth/users";
import { readSessionCookie, verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

/**
 * GET /api/v1/auth/me: the signed-in user plus their live mINR balance.
 * The balance is a minor-unit integer string (SPDD section 12.1). If the chain cannot be reached
 * the balance is null with balance_error set; it is never silently reported as zero.
 */
export async function GET(request: Request) {
  const session = await verifySession(readSessionCookie(request));
  if (!session) return apiError(401, "UNAUTHENTICATED", "Please sign in.");

  const user = findUserById(getDb(), session.userId);
  if (!user) return apiError(401, "USER_NOT_FOUND", "This account no longer exists.");

  try {
    const balance = await getMinrBalance(user.walletAddress);
    return Response.json({ user, balance_minor_units: balance.toString(), balance_error: null });
  } catch {
    return Response.json({ user, balance_minor_units: null, balance_error: "BALANCE_UNAVAILABLE" });
  }
}
