import { createChainReader } from "../chain/reader";
import type { Db } from "../db";
import { getEnv } from "../env";
import { syncOnce, type SyncResult } from "./sync";
import type { ChainReader, IndexerConfig } from "./types";

export interface IndexerRuntime {
  reader: ChainReader;
  config: IndexerConfig;
  /** The BeneficiaryRegistry, when configured: lets the public page link to it for independent checks. */
  registryAddress?: string;
}

/**
 * The indexer needs the factory address and the block to start from. Without them it stays off
 * and says so, rather than guessing a start block and silently missing events.
 */
export function indexerRuntime(): IndexerRuntime | null {
  const env = getEnv();
  if (!env.FACTORY_ADDRESS || env.INDEXER_START_BLOCK === undefined) return null;
  return {
    reader: createChainReader(env.FACTORY_ADDRESS, env.MILESTONE_MANAGER_ADDRESS, env.BENEFICIARY_REGISTRY_ADDRESS),
    registryAddress: env.BENEFICIARY_REGISTRY_ADDRESS,
    config: {
      startBlock: env.INDEXER_START_BLOCK,
      managerStartBlock: env.MILESTONE_MANAGER_ADDRESS ? env.MANAGER_START_BLOCK : undefined,
      registryStartBlock: env.BENEFICIARY_REGISTRY_ADDRESS ? env.REGISTRY_START_BLOCK : undefined,
      confirmations: env.INDEXER_CONFIRMATIONS,
      maxRange: env.INDEXER_MAX_RANGE,
    },
  };
}

interface SyncState {
  lastStartedAt: number;
  inflight: Promise<SyncResult> | null;
}

const globalForSync = globalThis as unknown as { __veraSync?: SyncState };
const state = (): SyncState => (globalForSync.__veraSync ??= { lastStartedAt: 0, inflight: null });

/** Test hook. */
export function resetSyncState(): void {
  globalForSync.__veraSync = undefined;
}

/**
 * Runs a sync unless one ran within `maxAgeMs`; concurrent callers share a single in-flight pass.
 * This is how reads keep data within the lag window (SPDD Step 8: under 30 seconds) without a
 * background worker, which a serverless host would not keep alive.
 */
export async function syncIfStale(
  db: Db,
  runtime: IndexerRuntime,
  maxAgeMs = 10_000,
  now = Date.now(),
): Promise<SyncResult | null> {
  const s = state();
  if (s.inflight) return s.inflight;
  if (now - s.lastStartedAt < maxAgeMs) return null;

  s.lastStartedAt = now;
  s.inflight = syncOnce(db, runtime.reader, runtime.config).finally(() => {
    s.inflight = null;
  });
  return s.inflight;
}
