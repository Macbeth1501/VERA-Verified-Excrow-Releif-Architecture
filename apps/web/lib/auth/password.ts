import bcrypt from "bcryptjs";

/** Ref: SPDD §13.4 — minimum 12 characters, bcrypt/argon2 hashing. */
export const MIN_PASSWORD_LENGTH = 12;
// Production strength everywhere except automated tests (vitest sets NODE_ENV=test), where hashing
// dozens of throwaway accounts at full cost would make the suite needlessly slow.
const COST = process.env.NODE_ENV === "test" ? 4 : 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Valid bcrypt hash of a random string, compared against when the account does not exist so
 *  that "unknown email" and "wrong password" take the same time. */
export const DUMMY_HASH = bcrypt.hashSync("vera-timing-equaliser", COST);
