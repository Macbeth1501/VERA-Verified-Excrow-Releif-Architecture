import { createPublicClient, erc20Abi, fallback, http, parseAbi, parseAbiItem } from "viem";
import { polygonAmoy } from "viem/chains";
import type { ChainReader, RawEvent } from "../indexer/types";
import { getEnv, parseRpcUrls } from "../env";

const campaignCreated = parseAbiItem(
  "event CampaignCreated(uint256 indexed campaignId, address indexed organizer, address indexed vault, uint8 category, uint256 fundingGoal)",
);
const donationReceived = parseAbiItem(
  "event DonationReceived(address indexed donor, uint256 amount, uint256 newBalance)",
);
const vaultAbi = parseAbi(["function getBalance() view returns (uint256)"]);
const managerEvents = [
  parseAbiItem("event MilestoneDefined(address indexed vault, uint256 indexed index, uint256 targetPct, uint256 requiredAttestations, uint256 autoReleaseLimit)"),
  parseAbiItem("event MilestoneAttested(address indexed vault, uint256 indexed index, address indexed attestor, bytes32 proofHash)"),
  parseAbiItem("event MilestoneVerified(address indexed vault, uint256 indexed index)"),
  parseAbiItem("event CouncilApproved(address indexed vault, uint256 indexed index, address indexed member)"),
  parseAbiItem("event MilestoneReleased(address indexed vault, uint256 indexed index, address indexed recipient, uint256 amount)"),
] as const;
const beneficiaryRegistered = parseAbiItem(
  "event BeneficiaryRegistered(address indexed vault, bytes32 indexed identityHash, bytes32 photoHash, uint256 index)",
);

/** Timestamp lookups are fetched a few at a time so a busy range does not flood a public RPC. */
const TIMESTAMP_BATCH = 5;

/**
 * The real chain reader for the indexer: public events from the CampaignFactory and its vaults,
 * read directly over RPC with the same ordered fallback list as everything else (SPDD 7.3).
 */
export function createChainReader(factoryAddress: string, managerAddress?: string, registryAddress?: string): ChainReader {
  const env = getEnv();
  const client = createPublicClient({
    chain: polygonAmoy,
    transport: fallback(parseRpcUrls(env.RPC_URL).map((url) => http(url, { timeout: 15_000, retryCount: 0 }))),
  });
  const factory = factoryAddress as `0x${string}`;

  return {
    async headBlock() {
      return Number(await client.getBlockNumber());
    },

    async factoryEvents(fromBlock, toBlock) {
      const logs = await client.getLogs({
        address: factory,
        event: campaignCreated,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
      });
      return logs.map<RawEvent>((log) => ({
        name: "CampaignCreated",
        contract: log.address,
        vault: log.args.vault ?? "",
        blockNumber: Number(log.blockNumber),
        txHash: log.transactionHash,
        logIndex: log.logIndex,
        args: {
          campaignId: String(log.args.campaignId),
          organizer: log.args.organizer ?? "",
          vault: log.args.vault ?? "",
          category: String(log.args.category),
          fundingGoal: String(log.args.fundingGoal),
        },
      }));
    },

    async vaultEvents(vault, fromBlock, toBlock) {
      const logs = await client.getLogs({
        address: vault as `0x${string}`,
        event: donationReceived,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
      });
      return logs.map<RawEvent>((log) => ({
        name: "DonationReceived",
        contract: log.address,
        vault: log.address,
        blockNumber: Number(log.blockNumber),
        txHash: log.transactionHash,
        logIndex: log.logIndex,
        args: {
          donor: log.args.donor ?? "",
          amount: String(log.args.amount),
          newBalance: String(log.args.newBalance),
        },
      }));
    },

    async managerEvents(fromBlock, toBlock) {
      if (!managerAddress) return [];
      const logs = await client.getLogs({
        address: managerAddress as `0x${string}`,
        events: managerEvents,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
      });
      return logs.map<RawEvent>((log) => {
        const args = (log.args ?? {}) as Record<string, unknown>;
        return {
          name: log.eventName,
          contract: log.address,
          vault: String(args.vault ?? ""),
          blockNumber: Number(log.blockNumber),
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          args: Object.fromEntries(Object.entries(args).map(([k, v]) => [k, String(v)])),
        };
      });
    },

    async registryEvents(fromBlock, toBlock) {
      if (!registryAddress) return [];
      const logs = await client.getLogs({
        address: registryAddress as `0x${string}`,
        event: beneficiaryRegistered,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
      });
      return logs.map<RawEvent>((log) => ({
        name: "BeneficiaryRegistered",
        contract: log.address,
        vault: log.args.vault ?? "",
        blockNumber: Number(log.blockNumber),
        txHash: log.transactionHash,
        logIndex: log.logIndex,
        args: {
          vault: log.args.vault ?? "",
          identityHash: log.args.identityHash ?? "",
          photoHash: log.args.photoHash ?? "",
          index: String(log.args.index),
        },
      }));
    },

    async blockTimestamps(blocks) {
      const result = new Map<number, string>();
      for (let i = 0; i < blocks.length; i += TIMESTAMP_BATCH) {
        const batch = blocks.slice(i, i + TIMESTAMP_BATCH);
        const fetched = await Promise.all(batch.map((b) => client.getBlock({ blockNumber: BigInt(b) })));
        fetched.forEach((block, index) => {
          result.set(batch[index], new Date(Number(block.timestamp) * 1000).toISOString());
        });
      }
      return result;
    },

    async vaultBalancesAt(vault, block) {
      const blockNumber = BigInt(block);
      const address = vault as `0x${string}`;
      const [tracked, token] = await Promise.all([
        client.readContract({ address, abi: vaultAbi, functionName: "getBalance", blockNumber }),
        client.readContract({
          address: env.MOCK_INR_ADDRESS as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
          blockNumber,
        }),
      ]);
      return { tracked, token };
    },
  };
}
