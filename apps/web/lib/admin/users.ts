import { and, asc, count, desc, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db";
import { organizerProfiles, users, type UserRow } from "../db/schema";

/**
 * The admin's directory of registered accounts. Emails are personal data, so this is only ever called
 * from admin-only code, and it names its columns explicitly: the password hash, the email hash and the
 * encrypted wallet key are never selected, so they cannot leak through a later change to a response.
 */

/** Every role an account can hold, in the order the filter shows them. */
export const USER_ROLES = ["donor", "organizer", "attestor", "council", "admin"] as const satisfies readonly UserRow["role"][];

/** One account as the admin sees it: no credentials, no key material. */
export interface UserSummary {
  id: string;
  email: string;
  role: UserRow["role"];
  walletAddress: string;
  /** "generated" = created by VERA; "external" = the user's own address (not verified). */
  walletType: UserRow["walletType"];
  createdAt: string;
  /** The account's organizer application status, or null if it never applied. */
  organizerStatus: "pending" | "verified" | "rejected" | null;
}

export interface UserListQuery {
  /** Case-insensitive text to find in the email address. */
  q?: string;
  role?: UserRow["role"];
  limit?: number;
  offset?: number;
}

export interface UserListPage {
  users: UserSummary[];
  /** Accounts matching the filter. */
  total: number;
  /** All accounts per role, ignoring the filter, for the filter menu. */
  countsByRole: Record<UserRow["role"], number>;
  limit: number;
  offset: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Narrows a free-text value to a real role, or undefined. */
export function parseRole(value: string | null | undefined): UserRow["role"] | undefined {
  return (USER_ROLES as readonly string[]).includes(value ?? "") ? (value as UserRow["role"]) : undefined;
}

/**
 * Accounts, newest first. `q` matches anywhere in the email, ignoring case; it is compared with
 * `instr`, not `LIKE`, so `%` and `_` typed by the admin are ordinary characters.
 */
export function listUsers(db: Db, query: UserListQuery = {}): UserListPage {
  const limit = Math.min(Math.max(Math.trunc(query.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Math.trunc(query.offset ?? 0) || 0, 0);

  const conditions: SQL[] = [];
  const q = query.q?.trim().toLowerCase();
  if (q) conditions.push(sql`instr(lower(${users.email}), ${q}) > 0`);
  if (query.role) conditions.push(eq(users.role, query.role));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      walletAddress: users.walletAddress,
      walletType: users.walletType,
      createdAt: users.createdAt,
      organizerStatus: organizerProfiles.kybStatus,
    })
    .from(users)
    .leftJoin(organizerProfiles, eq(organizerProfiles.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt), asc(users.email))
    .limit(limit)
    .offset(offset)
    .all();

  const total = db.select({ n: count() }).from(users).where(where).get()?.n ?? 0;

  const countsByRole = Object.fromEntries(USER_ROLES.map((r) => [r, 0])) as Record<UserRow["role"], number>;
  for (const r of db.select({ role: users.role, n: count() }).from(users).groupBy(users.role).all()) countsByRole[r.role] = r.n;

  return { users: rows, total, countsByRole, limit, offset };
}
