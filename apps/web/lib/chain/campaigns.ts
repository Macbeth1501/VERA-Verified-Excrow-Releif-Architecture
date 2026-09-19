import { createPublicClient, createWalletClient, fallback, http, parseAbi, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { decryptSecret } from "../auth/crypto";
import { CATEGORY_ENUM_INDEX, ceilingFor, type CampaignCategory } from "../campaigns/ceilings";
import type { VaultDeployResult } from "../campaigns/service";
import { getEnv, parseRpcUrls } from "../env";
import { gasPriceRefusal, topUpGas } from "./sponsor";

export const factoryAbi = parseAbi([
  "struct MilestoneInput { uint256 targetPct; }",
  "function createCampaign(uint8 category, uint256 fundingGoal, MilestoneInput[] milestones, uint256 adminCapPct) returns (uint256 campaignId, address vault)",
  "function isVerifiedOrganizer(address organizer) view returns (bool)",
  "function categoryAdminCeilingPct(uint8 category) view returns (uint256)",
  "event CampaignCreated(uint256 indexed campaignId, address indexed organizer, address indexed vault, uint8 category, uint256 fundingGoal)",
]);

/** Used only if gas estimation is refused (for example when the wallet has no POL at all). */
const FALLBACK_GAS = 1_500_000n;

export interface DeployVaultParams {
  organizerAddress: string;
  /** AES-GCM encrypted key of the organizer's generated wallet; null for a donor-supplied address. */
  organizerWalletKeyEnc: string | null;
  category: CampaignCategory;
  fundingGoalMinorUnits: string;
  adminExpenseCapPct: number;
  milestonePcts: number[];
}

function transport() {
  return fallback(parseRpcUrls(getEnv().RPC_URL).map((url) => http(url, { timeout: 20_000, retryCount: 1 })));
}

const failed = (error: string): VaultDeployResult => ({ status: "failed", error });

/**
 * Deploys a campaign's vault through `CampaignFactory.createCampaign`.
 *
 * The Factory records `msg.sender` as the organizer and independently re-checks that they are
 * verified (SPDD §18.1), so the transaction must be sent from the organizer's own wallet — not
 * the platform's. For a generated wallet the server holds the encrypted key and signs for the
 * organizer, topping it up with gas from the sponsor wallet first. A donor-supplied ("external")
 * address cannot be signed for and needs wallet connect (Step 10).
 *
 * Never throws: every failure is returned so it can be recorded and retried without losing the
 * saved campaign.
 */
export async function deployCampaignVault(params: DeployVaultParams): Promise<VaultDeployResult> {
  const env = getEnv();
  // Both are required: FACTORY_ADDRESS alone is also used by the read-only indexer, and a generated
  // organizer wallet has no POL, so publishing needs the sponsor key to fund its gas.
  if (!env.FACTORY_ADDRESS || !env.FACTORY_OWNER_KEY) return { status: "not_configured" };
  if (!params.organizerWalletKeyEnc) {
    return failed("This organizer uses their own wallet, which the server cannot sign for. Wallet connect is not built yet.");
  }

  const factory = env.FACTORY_ADDRESS as `0x${string}`;
  const organizer = params.organizerAddress as `0x${string}`;
  const categoryIndex = CATEGORY_ENUM_INDEX[params.category];
  const publicClient = createPublicClient({ chain: polygonAmoy, transport: transport() });

  try {
    if (!(await publicClient.readContract({ address: factory, abi: factoryAbi, functionName: "isVerifiedOrganizer", args: [organizer] }))) {
      return failed("This organizer is not verified on the CampaignFactory contract yet. Approve and sync them on-chain first.");
    }

    // The contract's ceiling is authoritative; refuse early rather than sending a doomed tx.
    const chainCeiling = await publicClient.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "categoryAdminCeilingPct",
      args: [categoryIndex],
    });
    if (BigInt(params.adminExpenseCapPct) > chainCeiling) {
      return failed(`The contract allows at most ${chainCeiling}% admin costs for this category (the app expected ${ceilingFor(params.category)}%).`);
    }

    const account = privateKeyToAccount(decryptSecret(params.organizerWalletKeyEnc, env.WALLET_ENCRYPTION_KEY) as `0x${string}`);
    if (account.address.toLowerCase() !== organizer.toLowerCase()) {
      return failed("The stored wallet key does not match the organizer's address.");
    }

    const args = [
      categoryIndex,
      BigInt(params.fundingGoalMinorUnits),
      params.milestonePcts.map((targetPct) => ({ targetPct: BigInt(targetPct) })),
      BigInt(params.adminExpenseCapPct),
    ] as const;

    const gas = await publicClient
      .estimateContractGas({ address: factory, abi: factoryAbi, functionName: "createCampaign", args, account })
      .catch(() => FALLBACK_GAS);
    const gasPrice = await publicClient.getGasPrice();
    const tooExpensive = gasPriceRefusal(gasPrice);
    if (tooExpensive) return failed(tooExpensive);
    const funded = await topUpGas(organizer, (gas * gasPrice * 15n) / 10n, { wait: true });
    if (!funded.ok) return failed(funded.error);

    const wallet = createWalletClient({ account, chain: polygonAmoy, transport: transport() });
    const txHash = await wallet.writeContract({
      address: factory,
      abi: factoryAbi,
      functionName: "createCampaign",
      args,
      gas: (gas * 12n) / 10n,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
    if (receipt.status !== "success") return failed("The transaction was reverted by the contract.");

    const [event] = parseEventLogs({ abi: factoryAbi, eventName: "CampaignCreated", logs: receipt.logs });
    if (!event) return failed("The vault was not found in the transaction logs.");

    return {
      status: "deployed",
      vaultAddress: event.args.vault,
      onchainCampaignId: Number(event.args.campaignId),
      txHash,
    };
  } catch (err) {
    return failed(err instanceof Error ? err.message.split("\n")[0].slice(0, 200) : "unknown error");
  }
}
