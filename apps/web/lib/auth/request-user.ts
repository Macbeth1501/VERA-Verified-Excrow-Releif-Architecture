import type { Db } from "../db";
import { findUserById, type PublicUser } from "./users";
import { readSessionCookie, verifySession, type Role } from "./session";

/**
 * Resolves the signed-in user for an API request. Authorization decisions use the role stored in
 * the database, not the one inside the session token, so a role change (for example an approved
 * organizer) takes effect immediately without re-login.
 */
export async function getRequestUser(request: Request, db: Db): Promise<PublicUser | null> {
  const session = await verifySession(readSessionCookie(request));
  return session ? findUserById(db, session.userId) : null;
}

export function hasRole(user: PublicUser, ...roles: Role[]): boolean {
  return roles.includes(user.role);
}
