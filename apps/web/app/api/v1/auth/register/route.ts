import { apiError } from "@/lib/api/errors";
import { allow, clientKey } from "@/lib/api/rate-limit";
import { EmailAlreadyRegisteredError, registerDonor } from "@/lib/auth/users";
import { registerSchema } from "@/lib/auth/validation";
import { sessionCookieHeader, signSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";

/** POST /api/v1/auth/register: donor signup (FR-IDN-01, SPDD section 12.2). */
export async function POST(request: Request) {
  if (!allow(`register:${clientKey(request)}`, { capacity: 5, refillPerSecond: 5 / 60 })) {
    return apiError(429, "RATE_LIMITED", "Too many attempts. Please wait a minute and try again.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_FAILED", "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const user = await registerDonor(getDb(), parsed.data, getEnv().WALLET_ENCRYPTION_KEY);
    const token = await signSession({ userId: user.id, role: user.role });
    return Response.json(
      { user_id: user.id, wallet_address: user.walletAddress, user },
      { status: 201, headers: { "Set-Cookie": sessionCookieHeader(token) } },
    );
  } catch (err) {
    if (err instanceof EmailAlreadyRegisteredError) {
      return apiError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists. Try signing in instead.");
    }
    console.error(JSON.stringify({ event: "register_failed", message: err instanceof Error ? err.message : "unknown" }));
    return apiError(500, "INTERNAL_ERROR", "Something went wrong creating your account.");
  }
}
