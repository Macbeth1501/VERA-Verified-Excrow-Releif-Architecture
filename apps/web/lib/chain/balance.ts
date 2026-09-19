import { createPublicClient, erc20Abi, fallback, http } from "viem";
import { polygonAmoy } from "viem/chains";
import { getEnv, parseRpcUrls } from "../env";

export const MINR_DECIMALS = 6;

/** Reads a wallet's mINR balance from Polygon Amoy, in the token's smallest unit. */
export async function getMinrBalance(address: string): Promise<bigint> {
  const env = getEnv();
  const client = createPublicClient({
    chain: polygonAmoy,
    // Tries each configured RPC in order, moving on when one errors or times out.
    transport: fallback(parseRpcUrls(env.RPC_URL).map((url) => http(url, { timeout: 6_000, retryCount: 0 }))),
  });
  return client.readContract({
    address: env.MOCK_INR_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });
}

/** Formats a raw mINR amount as rupees with two decimals, e.g. 250000000n -> "₹250.00". */
export function formatRupees(raw: bigint): string {
  const unit = 10n ** BigInt(MINR_DECIMALS);
  const whole = raw / unit;
  const cents = ((raw % unit) * 100n) / unit;
  return `₹${whole.toLocaleString("en-IN")}.${cents.toString().padStart(2, "0")}`;
}
