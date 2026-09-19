import { createPublicClient, createWalletClient, fallback, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { getEnv, parseRpcUrls } from "../env";

function transport() {
  return fallback(parseRpcUrls(getEnv().RPC_URL).map((url) => http(url, { timeout: 20_000, retryCount: 1 })));
}

/**
 * Serialises everything the sponsor wallet sends. Two transactions from one wallet at the same
 * moment would race for the same nonce and one would fail, so concurrent top-ups (several donors,
 * or a donor and an organizer) queue behind each other instead.
 */
let queue: Promise<unknown> = Promise.resolve();
export function withSponsorLock<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Amoy's gas price is normally about 30 gwei but has spiked past 500 gwei, which turns a routine
 * deploy or top-up into a drain on the sponsor wallet. Above this ceiling sponsored actions refuse
 * to run and can simply be retried a little later.
 */
export const MAX_GAS_PRICE_WEI = 150_000_000_000n;

/** A user-facing refusal when gas is unusually expensive right now, or null when it is fine to go ahead. */
export function gasPriceRefusal(gasPriceWei: bigint): string | null {
  if (gasPriceWei <= MAX_GAS_PRICE_WEI) return null;
  const gwei = Number(gasPriceWei / 1_000_000_000n);
  return `Network fees are unusually high right now (${gwei} gwei, normally about 30), so this was not sent. Please try again in a few minutes.`;
}

export type TopUpResult =
  | { ok: true; txHash: string | null }
  | { ok: false; error: string };

export interface TopUpOptions {
  /** Wait for the top-up to be mined before returning. */
  wait: boolean;
}

/**
 * Tops `to` up to `requiredWei` of POL from the sponsor wallet, because a generated wallet has no
 * funds of its own. `txHash` is null when no top-up was needed. With `wait: false` the hash is
 * returned as soon as the transaction is sent, and the caller confirms it later.
 */
export async function topUpGas(to: string, requiredWei: bigint, { wait }: TopUpOptions): Promise<TopUpResult> {
  const env = getEnv();
  if (!env.FACTORY_OWNER_KEY) {
    return { ok: false, error: "The wallet has no POL for gas and no sponsor wallet is configured." };
  }

  try {
    const publicClient = createPublicClient({ chain: polygonAmoy, transport: transport() });
    const address = to as `0x${string}`;
    const balance = await publicClient.getBalance({ address });
    if (balance >= requiredWei) return { ok: true, txHash: null };

    const sponsor = privateKeyToAccount(env.FACTORY_OWNER_KEY as `0x${string}`);
    const topUp = requiredWei - balance;
    if ((await publicClient.getBalance({ address: sponsor.address })) < topUp) {
      return { ok: false, error: "The sponsor wallet does not have enough POL to cover gas. Top it up from the faucet." };
    }

    return await withSponsorLock(async () => {
      const wallet = createWalletClient({ account: sponsor, chain: polygonAmoy, transport: transport() });
      const hash = await wallet.sendTransaction({ to: address, value: topUp });
      if (wait) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
        if (receipt.status !== "success") return { ok: false as const, error: "Could not fund the wallet for gas." };
      }
      return { ok: true as const, txHash: hash };
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.split("\n")[0].slice(0, 200) : "unknown error" };
  }
}
