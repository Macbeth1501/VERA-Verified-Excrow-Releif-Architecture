import { isAddress } from "viem";
import { z } from "zod";

/**
 * Server-side environment, validated lazily on first use so `next build` and tests do not
 * need every variable. Secrets are never logged.
 * Ref: SPDD §13.4 (secrets live in env vars, never committed).
 */
const DEFAULT_RPC_URLS = [
  "https://polygon-amoy.drpc.org",
  "https://polygon-amoy-bor-rpc.publicnode.com",
  "https://polygon-amoy.gateway.tenderly.co",
];

export function parseRpcUrls(value: string): string[] {
  return value
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * An EVM address, validated including its EIP-55 checksum when it has mixed case, so a typo is
 * rejected when the server reads its config rather than halfway through a transaction.
 */
const address = () => z.string().refine((v) => isAddress(v), "must be a valid address (check the letter case / checksum)");

/** Blank values in .env files mean "unset", not zero. */
const optionalInt = (min: number) =>
  z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(min).optional());

const schema = z.object({
  /** SQLite file path (local $0 database, SPDD §7.3). */
  DATABASE_URL: z.string().min(1).default("./data/vera.db"),
  /** HMAC key for signing session tokens. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  /** 32-byte key, hex encoded (64 chars), used to encrypt generated demo-wallet keys at rest. */
  WALLET_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "WALLET_ENCRYPTION_KEY must be 64 hex characters"),
  /** Polygon Amoy RPC URL(s) for balance reads. Comma-separated list; later entries are used
   *  as fallbacks when earlier ones fail, since free public RPCs are sometimes down. */
  RPC_URL: z
    .string()
    .default(DEFAULT_RPC_URLS.join(","))
    .refine((v) => parseRpcUrls(v).length > 0 && parseRpcUrls(v).every(isHttpUrl), "RPC_URL must be one or more http(s) URLs, comma-separated"),
  /**
   * Optional: CampaignFactory address and its owner key. When both are set, approving an
   * organizer also calls setOrganizerVerified on-chain. The owner key controls the Factory, so
   * only ever use a testnet key; leave unset to record approvals off-chain only.
   */
  FACTORY_ADDRESS: address().optional(),
  FACTORY_OWNER_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .optional(),
  /**
   * Indexer (SPDD 9.5). First block to read for the CampaignFactory. Required for the indexer to
   * run: scanning from genesis would take hours, and guessing would silently miss events.
   */
  INDEXER_START_BLOCK: optionalInt(0),
  /**
   * The shared MilestoneManager (Step 4) and the block it was deployed in. With the address set,
   * milestones can be defined, attested, approved and released; with the start block also set, the
   * indexer reads its events so releases reach the ledger.
   */
  MILESTONE_MANAGER_ADDRESS: address().optional(),
  MANAGER_START_BLOCK: optionalInt(0),
  /** Only read blocks at least this deep, so a shallow reorg cannot leave phantom events. */
  INDEXER_CONFIRMATIONS: optionalInt(0).default(2),
  /** Largest block range per getLogs call; shrinks automatically if an RPC refuses it. */
  INDEXER_MAX_RANGE: optionalInt(1).default(2000),
  /**
   * Optional flat protocol fee per donation, in mINR minor units (SPDD FR-CMP-02: a single fixed,
   * disclosed fee, 0 by default). When above zero the donor is shown it as an itemized, NOT
   * pre-selected choice next to "no thanks", and it is paid on top of the donation so 100% of the
   * donation reaches the vault. Requires PLATFORM_FEE_ADDRESS.
   */
  PLATFORM_FEE_MINOR_UNITS: optionalInt(0).default(0),
  PLATFORM_FEE_ADDRESS: address().optional(),
  /** Deployed MockINR token (mINR) address. */
  MOCK_INR_ADDRESS: address(),
}).superRefine((env, ctx) => {
  if (env.PLATFORM_FEE_MINOR_UNITS > 0 && !env.PLATFORM_FEE_ADDRESS) {
    ctx.addIssue({ code: "custom", path: ["PLATFORM_FEE_ADDRESS"], message: "PLATFORM_FEE_ADDRESS is required when a fee is set" });
  }
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      throw new Error(`Invalid server environment: ${problems.join("; ")}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Test hook: forget the cached env so a test can change process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
