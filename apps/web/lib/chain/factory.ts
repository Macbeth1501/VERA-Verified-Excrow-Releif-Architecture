import { createPublicClient, createWalletClient, fallback, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { getEnv, parseRpcUrls } from "../env";

const factoryAbi = parseAbi([
  "function setOrganizerVerified(address organizer, bool verified)",
  "function isVerifiedOrganizer(address organizer) view returns (bool)",
]);

export type ChainSyncResult =
  | { status: "synced"; txHash: string }
  | { status: "not_configured" }
  | { status: "failed"; error: string };

function transport() {
  return fallback(parseRpcUrls(getEnv().RPC_URL).map((url) => http(url, { timeout: 15_000, retryCount: 0 })));
}

/**
 * Mirrors an approval on-chain by calling CampaignFactory.setOrganizerVerified(address, true),
 * so the rule "only verified organizers may create campaigns" holds in the app and on-chain
 * (SPDD 18.1, Functional Roadmap 1.4). Never throws: a failure is reported so the caller can
 * record it and retry.
 */
export async function syncOrganizerVerification(organizerAddress: string): Promise<ChainSyncResult> {
  const env = getEnv();
  if (!env.FACTORY_ADDRESS || !env.FACTORY_OWNER_KEY) return { status: "not_configured" };

  try {
    const factory = env.FACTORY_ADDRESS as `0x${string}`;
    const address = organizerAddress as `0x${string}`;
    const publicClient = createPublicClient({ chain: polygonAmoy, transport: transport() });

    // Idempotent: if the chain already agrees, do not spend gas.
    const already = await publicClient.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "isVerifiedOrganizer",
      args: [address],
    });
    if (already) return { status: "synced", txHash: "already-verified-on-chain" };

    const wallet = createWalletClient({
      account: privateKeyToAccount(env.FACTORY_OWNER_KEY as `0x${string}`),
      chain: polygonAmoy,
      transport: transport(),
    });
    const txHash = await wallet.writeContract({
      address: factory,
      abi: factoryAbi,
      functionName: "setOrganizerVerified",
      args: [address, true],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 90_000 });
    if (receipt.status !== "success") return { status: "failed", error: "Transaction reverted on-chain" };
    return { status: "synced", txHash };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message.split("\n")[0].slice(0, 200) : "unknown error" };
  }
}
