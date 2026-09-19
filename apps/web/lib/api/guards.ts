import { getRequestUser } from "../auth/request-user";
import type { Role } from "../auth/session";
import type { PublicUser } from "../auth/users";
import { getDb } from "../db";
import { apiError } from "./errors";

type Guarded = { user: PublicUser; response?: undefined } | { user?: undefined; response: Response };

/** Requires a signed-in user, optionally with one of the given roles (checked against the DB). */
export async function requireUser(request: Request, ...roles: Role[]): Promise<Guarded> {
  const user = await getRequestUser(request, getDb());
  if (!user) return { response: apiError(401, "UNAUTHENTICATED", "Please sign in.") };
  if (roles.length > 0 && !roles.includes(user.role)) {
    return { response: apiError(403, "FORBIDDEN", "You do not have permission to do this.") };
  }
  return { user };
}

type JsonResult = { body: unknown; response?: undefined } | { body?: undefined; response: Response };

export async function readJson(request: Request): Promise<JsonResult> {
  try {
    return { body: await request.json() };
  } catch {
    return { response: apiError(400, "INVALID_JSON", "Request body must be valid JSON.") };
  }
}
