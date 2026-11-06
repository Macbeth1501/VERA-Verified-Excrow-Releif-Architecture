import { apiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { listUsers, parseRole } from "@/lib/admin/users";
import { getDb } from "@/lib/db";

/**
 * GET /api/v1/admin/users: every registered account with its email address, role, wallet address and
 * organizer-application status. Admin only (emails are personal data), read from the database on every
 * request. Never returns a password hash, an email hash or any wallet key material.
 *
 * Query: `q` (text to find in the email), `role`, `limit` (1-200, default 50), `offset`.
 */
export async function GET(request: Request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const roleParam = url.searchParams.get("role");
  if (roleParam && !parseRole(roleParam)) return apiError(400, "VALIDATION_FAILED", "Unknown role.");
  const number = (name: string) => {
    const raw = url.searchParams.get(name);
    return raw === null || raw === "" ? undefined : Number(raw);
  };
  const limit = number("limit");
  const offset = number("offset");
  if ((limit !== undefined && !Number.isFinite(limit)) || (offset !== undefined && !Number.isFinite(offset))) {
    return apiError(400, "VALIDATION_FAILED", "limit and offset must be numbers.");
  }

  const page = listUsers(getDb(), { q: url.searchParams.get("q") ?? undefined, role: parseRole(roleParam), limit, offset });
  return Response.json(page, { headers: { "cache-control": "no-store" } });
}
