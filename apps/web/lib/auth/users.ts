import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getAddress } from "viem";
import type { Db } from "../db";
import { users, type UserRow } from "../db/schema";
import { generateWallet } from "../chain/wallet";
import { encryptSecret, hashEmail, normalizeEmail } from "./crypto";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password";
import type { LoginInput, RegisterInput } from "./validation";

/** The only user shape that ever leaves the server: no password hash, no wallet key. */
export interface PublicUser {
  id: string;
  email: string;
  role: UserRow["role"];
  walletAddress: string;
  walletType: UserRow["walletType"];
  createdAt: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    walletAddress: row.walletAddress,
    walletType: row.walletType,
    createdAt: row.createdAt,
  };
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with this email already exists");
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Incorrect email or password");
  }
}

/**
 * Creates a donor account and its wallet. Unless the donor supplied their own address, a fresh
 * testnet wallet is generated and its key stored encrypted (FR-IDN-01).
 * The unique index on email_hash is the authority for duplicates; the pre-check only gives a
 * fast, friendly path.
 */
export async function registerDonor(
  db: Db,
  input: RegisterInput,
  walletEncryptionKey: string,
): Promise<PublicUser> {
  const emailHash = hashEmail(input.email);
  if (db.select({ id: users.id }).from(users).where(eq(users.emailHash, emailHash)).get()) {
    throw new EmailAlreadyRegisteredError();
  }

  let walletAddress: string;
  let walletType: UserRow["walletType"];
  let walletKeyEnc: string | null;
  if (input.walletAddress) {
    walletAddress = getAddress(input.walletAddress);
    walletType = "external";
    walletKeyEnc = null;
  } else {
    const wallet = generateWallet();
    walletAddress = wallet.address;
    walletType = "generated";
    walletKeyEnc = encryptSecret(wallet.privateKey, walletEncryptionKey);
  }

  const row = {
    id: randomUUID(),
    email: normalizeEmail(input.email),
    emailHash,
    passwordHash: await hashPassword(input.password),
    walletAddress,
    walletType,
    walletKeyEnc,
    role: "donor" as const,
  };

  try {
    db.insert(users).values(row).run();
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed/i.test(err.message)) {
      throw new EmailAlreadyRegisteredError();
    }
    throw err;
  }
  const saved = db.select().from(users).where(eq(users.id, row.id)).get();
  if (!saved) throw new Error("User row missing after insert");
  return toPublicUser(saved);
}

/** Verifies credentials. Always runs one bcrypt comparison so timing does not reveal whether the
 *  email exists. */
export async function authenticate(db: Db, input: LoginInput): Promise<PublicUser> {
  const row = db.select().from(users).where(eq(users.emailHash, hashEmail(input.email))).get();
  const ok = await verifyPassword(input.password, row?.passwordHash ?? DUMMY_HASH);
  if (!row || !ok) throw new InvalidCredentialsError();
  return toPublicUser(row);
}

export function findUserById(db: Db, id: string): PublicUser | null {
  const row = db.select().from(users).where(eq(users.id, id)).get();
  return row ? toPublicUser(row) : null;
}

/**
 * Server-only: the encrypted private key of a user's generated wallet, or null for a
 * donor-supplied ("external") address. Never include this in an API response.
 */
export function getWalletKeyEnc(db: Db, userId: string): string | null {
  const row = db.select({ enc: users.walletKeyEnc }).from(users).where(eq(users.id, userId)).get();
  return row?.enc ?? null;
}
