import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserById, type PublicUser } from "../auth/users";
import { SESSION_COOKIE, verifySession } from "../auth/session";
import { getDb, type Db } from "../db";
import { getProfileByUser, type OrganizerProfile } from "../organizers/service";

/** Resolves the signed-in user for a server page, sending them to /login when there is none. */
export async function requirePageUser(): Promise<{ db: Db; user: PublicUser }> {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session === null) redirect("/login");
  const db = getDb();
  const user = findUserById(db, session.userId);
  if (user === null) redirect("/login");
  return { db, user };
}

/** As above, but also requires a verified organizer profile (sent to the KYB page otherwise). */
export async function requirePageOrganizer(): Promise<{ db: Db; user: PublicUser; profile: OrganizerProfile }> {
  const { db, user } = await requirePageUser();
  const profile = getProfileByUser(db, user.id);
  if (!profile || profile.kybStatus !== "verified") redirect("/dashboard/organizer");
  return { db, user, profile };
}

/** The signed-in user for a public page, or null. Never redirects: public pages work signed out. */
export async function getOptionalPageUser(): Promise<PublicUser | null> {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return session === null ? null : findUserById(getDb(), session.userId);
}
