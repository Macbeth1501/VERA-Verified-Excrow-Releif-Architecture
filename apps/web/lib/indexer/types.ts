/** Events from the CampaignFactory, the vaults, the MilestoneManager, the BeneficiaryRegistry and Disbursement. */
export type EventName =
  | "CampaignCreated"
  | "DonationReceived"
  | "MilestoneDefined"
  | "MilestoneAttested"
  | "MilestoneVerified"
  | "CouncilApproved"
  | "MilestoneReleased"
  | "BeneficiaryRegistered"
  | "PayoutRecorded";

/** A decoded on-chain event, as read from a contract. Amounts are decimal strings. */
export interface RawEvent {
  name: EventName;
  contract: string;
  /** The campaign vault this event belongs to. */
  vault: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  args: Record<string, string>;
}

/**
 * Everything the indexer needs from the chain. The real implementation is `lib/chain/reader.ts`
 * (viem); tests supply an in-memory fake. Methods may throw; the indexer handles that.
 */
export interface ChainReader {
  headBlock(): Promise<number>;
  /** CampaignCreated events from the CampaignFactory, inclusive block range. */
  factoryEvents(fromBlock: number, toBlock: number): Promise<RawEvent[]>;
  /** DonationReceived events from one vault, inclusive block range. */
  vaultEvents(vault: string, fromBlock: number, toBlock: number): Promise<RawEvent[]>;
  /**
   * All MilestoneManager events (every one names its vault), inclusive block range. Optional: a
   * reader without it simply indexes no milestone events.
   */
  managerEvents?(fromBlock: number, toBlock: number): Promise<RawEvent[]>;
  /**
   * BeneficiaryRegistered events from the BeneficiaryRegistry (each names its vault), inclusive block
   * range. Optional: a reader without it indexes no beneficiary events.
   */
  registryEvents?(fromBlock: number, toBlock: number): Promise<RawEvent[]>;
  /**
   * PayoutRecorded events from the Disbursement contract (each names its vault), inclusive block range.
   * Optional: a reader without it indexes no payouts.
   */
  disbursementEvents?(fromBlock: number, toBlock: number): Promise<RawEvent[]>;
  /** `Disbursement.disbursedTotal(vault)` at a given block: what the contract says was paid out. */
  disbursedTotalAt?(vault: string, block: number): Promise<bigint>;
  /** ISO timestamps for the given block numbers. */
  blockTimestamps(blocks: number[]): Promise<Map<number, string>>;
  /** The vault's internally tracked balance and its actual token balance at a given block. */
  vaultBalancesAt(vault: string, block: number): Promise<{ tracked: bigint; token: bigint }>;
}

export interface IndexerConfig {
  startBlock: number;
  /** First block to read for the MilestoneManager; milestone events are skipped when unset. */
  managerStartBlock?: number;
  /** First block to read for the BeneficiaryRegistry; beneficiary events are skipped when unset. */
  registryStartBlock?: number;
  /** First block to read for the Disbursement contract; payouts are skipped when unset. */
  disbursementStartBlock?: number;
  confirmations: number;
  maxRange: number;
}
