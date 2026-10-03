import type { Db } from "../db";
import { getEnv } from "../env";
import { freshness, type Freshness } from "../indexer/freshness";
import { indexerStatus } from "../indexer/queries";
import { syncWithinBudget, type IndexerRuntime } from "../indexer/runtime";
import { listActivity, type ActivityPage, type ActivityQuery, type KnownContracts } from "./activity";

export interface ActivityData extends ActivityPage {
  indexer: {
    configured: boolean;
    dataAsOfBlock: number | null;
    headBlock: number | null;
    lagBlocks: number | null;
    freshness: Freshness;
  };
  contracts: KnownContracts;
}

/** The deployed contract addresses the app is configured with, so rows can name the emitting contract. */
export function knownContractsFromEnv(): KnownContracts {
  const env = getEnv();
  return {
    factory: env.FACTORY_ADDRESS,
    manager: env.MILESTONE_MANAGER_ADDRESS,
    registry: env.BENEFICIARY_REGISTRY_ADDRESS,
    disbursement: env.DISBURSEMENT_ADDRESS,
  };
}

/**
 * The single source for the Chain activity page and its API. Refreshes the indexer when its data is
 * stale (like the campaign ledger does) and says how fresh the data is, so a lagging or switched-off
 * indexer is never presented as a complete history.
 */
export async function buildActivity(
  db: Db,
  runtime: IndexerRuntime | null,
  contracts: KnownContracts,
  query: ActivityQuery,
): Promise<ActivityData> {
  if (runtime) await syncWithinBudget(db, runtime);
  const status = await indexerStatus(db, runtime?.reader ?? null);
  return {
    ...listActivity(db, contracts, query),
    indexer: {
      configured: runtime !== null,
      dataAsOfBlock: status.indexedThroughBlock,
      headBlock: status.headBlock,
      lagBlocks: status.lagBlocks,
      freshness: freshness(runtime !== null, status.lagBlocks),
    },
    contracts,
  };
}
