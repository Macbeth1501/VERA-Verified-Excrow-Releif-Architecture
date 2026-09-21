import type { ChainReader, RawEvent } from "./types";

export const FACTORY = "0x6931e776da5db1d9e5890407fe268705d70740bd";
export const VAULT_A = "0x6590e3d9e42edb7e8970b9348ce457b9a2f990f7";
export const VAULT_B = "0xbf4cbafe6d51866e9e01e1b74fe9c9c57d17ccb8";
export const MANAGER = "0xe6d7222dde3ee4b9688269427631adf49229e747";
export const DONOR = "0x1111111111111111111111111111111111111111";
export const ORGANIZER = "0x2222222222222222222222222222222222222222";

let counter = 0;

export function created(vault: string, blockNumber: number): RawEvent {
  return {
    name: "CampaignCreated",
    contract: FACTORY,
    vault,
    blockNumber,
    txHash: `0xc${String(++counter).padStart(63, "0")}`,
    logIndex: 0,
    args: { campaignId: "0", organizer: ORGANIZER, vault, category: "0", fundingGoal: "1000000000" },
  };
}

export function donation(vault: string, blockNumber: number, amount: string, logIndex = 0, txHash?: string): RawEvent {
  return {
    name: "DonationReceived",
    contract: vault,
    vault,
    blockNumber,
    txHash: txHash ?? `0xd${String(++counter).padStart(63, "0")}`,
    logIndex,
    args: { donor: DONOR, amount, newBalance: amount },
  };
}

export function released(vault: string, blockNumber: number, amount: string, index = 0): RawEvent {
  return {
    name: "MilestoneReleased",
    contract: MANAGER,
    vault,
    blockNumber,
    txHash: `0xe${String(++counter).padStart(63, "0")}`,
    logIndex: 0,
    args: { vault, index: String(index), recipient: ORGANIZER, amount },
  };
}

export const REGISTRY = "0xdc64a140aa3e981100a9beca4e685f962f0cf6c9";

export function beneficiary(vault: string, blockNumber: number, identityHash: string, index = 0): RawEvent {
  return {
    name: "BeneficiaryRegistered",
    contract: REGISTRY,
    vault,
    blockNumber,
    txHash: `0xb${String(++counter).padStart(63, "0")}`,
    logIndex: 0,
    args: { vault, identityHash, photoHash: `0x${"0".repeat(64)}`, index: String(index) },
  };
}

export function attested(vault: string, blockNumber: number, index = 0, attestor = "0x3333333333333333333333333333333333333333"): RawEvent {
  return {
    name: "MilestoneAttested",
    contract: MANAGER,
    vault,
    blockNumber,
    txHash: `0xf${String(++counter).padStart(63, "0")}`,
    logIndex: 0,
    args: { vault, index: String(index), attestor, proofHash: "0x" + "ab".repeat(32) },
  };
}

/**
 * An in-memory chain for tests. `maxRange` makes reads refuse wide ranges like a real public
 * RPC; `failFromBlock` makes reads reaching that block fail until cleared.
 */
export class FakeChain implements ChainReader {
  head = 1000;
  events: RawEvent[] = [];
  maxRange = Number.POSITIVE_INFINITY;
  failFromBlock: number | null = null;
  headFails = false;
  balances = new Map<string, { tracked: bigint; token: bigint }>();
  calls: Array<{ kind: string; from: number; to: number }> = [];

  async headBlock() {
    if (this.headFails) throw new Error("rpc down");
    return this.head;
  }

  private read(kind: string, from: number, to: number, pick: (e: RawEvent) => boolean) {
    this.calls.push({ kind, from, to });
    if (to - from + 1 > this.maxRange) throw new Error("query exceeds max block range");
    if (this.failFromBlock !== null && to >= this.failFromBlock) throw new Error("rpc failure");
    return this.events.filter((e) => e.blockNumber >= from && e.blockNumber <= to && pick(e));
  }

  async factoryEvents(from: number, to: number) {
    return this.read("factory", from, to, (e) => e.name === "CampaignCreated");
  }

  async vaultEvents(vault: string, from: number, to: number) {
    return this.read(`vault:${vault}`, from, to, (e) => e.name === "DonationReceived" && e.vault === vault);
  }

  async managerEvents(from: number, to: number) {
    return this.read("manager", from, to, (e) => e.name.startsWith("Milestone") || e.name === "CouncilApproved");
  }

  async registryEvents(from: number, to: number) {
    return this.read("registry", from, to, (e) => e.name === "BeneficiaryRegistered");
  }

  async blockTimestamps(blocks: number[]) {
    return new Map(blocks.map((b) => [b, new Date(1_700_000_000_000 + b * 2000).toISOString()]));
  }

  async vaultBalancesAt(vault: string) {
    return this.balances.get(vault) ?? { tracked: 0n, token: 0n };
  }
}
