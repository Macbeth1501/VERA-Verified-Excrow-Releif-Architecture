import { apiError } from "@/lib/api/errors";
import { allow, clientKey } from "@/lib/api/rate-limit";
import { InvalidCredentialsError, authenticate } from "@/lib/auth/users";
import { loginSchema } from "@/lib/auth/validation";
import { sessionCookieHeader, signSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

/** POST /api/v1/auth/login */
export async function POST(request: Request) {
  if (!allow(`login:${clientKey(request)}`, { capacity: 10, refillPerSecond: 10 / 60 })) {
    return apiError(429, "RATE_LIMITED", "Too many attempts. Please wait a minute and try again.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_FAILED", "Enter your email and password.", parsed.error.flatten().fieldErrors);
  }

  try {
    const user = await authenticate(getDb(), parsed.data);
    const token = await signSession({ userId: user.id, role: user.role });
    return Response.json(
      { user_id: user.id, wallet_address: user.walletAddress, user },
      { headers: { "Set-Cookie": sessionCookieHeader(token) } },
    );
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return apiError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");
    }
    console.error(JSON.stringify({ event: "login_failed", message: err instanceof Error ? err.message : "unknown" }));
    return apiError(500, "INTERNAL_ERROR", "Something went wrong signing you in.");
  }
}
