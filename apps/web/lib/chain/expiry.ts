import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, fallback, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { decryptSecret } from "../auth/crypto";
import { getEnv, parseRpcUrls } from "../env";
import type { Signer, Tx } from "../escrow/chain-port";
import type { ExpiryChain } from "../expiry/chain-port";
import { gasPriceRefusal, topUpGas, withSponsorLock } from "./sponsor";

const vaultAbi = parseAbi([
  "function close()",
  "function claimRefund()",
  "function closed() view returns (bool)",
  "function refundOf(address donor) view returns (uint256)",
  "function refundClaimed(address donor) view returns (bool)",
  "error CampaignIsClosed()",
  "error DonationsClosed()",
  "error CannotCloseYet()",
  "error AlreadyClosed()",
  "error NothingToRefund()",
  "error NotClosed()",
  "error NoRefundDue()",
]);

/** Used only if gas estimation is refused. A refund is about 60,000 gas and a close about 50,000. */
const FALLBACK_GAS = 200_000n;

/** Plain-language reasons for the vault's custom errors. */
const REASONS: Record<string, string> = {
  CannotCloseYet: "This campaign cannot be closed yet: its end date has not passed, it has not stalled for the whole inactivity period, and its milestones are not all released.",
  AlreadyClosed: "This campaign has already been closed.",
  NothingToRefund: "There is nothing left in the vault to refund.",
  NotClosed: "This campaign has not been closed yet, so there is nothing to claim.",
  NoRefundDue: "You have no refund due on this campaign (you did not donate, or you have already claimed it).",
  CampaignIsClosed: "This campaign is closed.",
};

function transport() {
  return fallback(parseRpcUrls(getEnv().RPC_URL).map((url) => http(url, { timeout: 20_000, retryCount: 1 })));
}

/** A short, human message; unknown contract errors and RPC failures fall back to their first line. */
export function explainExpiryError(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      return REASONS[revert.data.errorName] ?? `The contract refused this (${revert.data.errorName}).`;
    }
  }
  return err instanceof Error ? err.message.split("\n")[0].slice(0, 200) : "unknown error";
}

/**
 * The real expiry chain: talks to the campaign vault directly. The close is permissionless, so the
 * sponsor wallet sends it (queued behind the sponsor lock); a refund is always sent from the donor's
 * own generated wallet, because the vault pays whoever calls it. Never throws.
 */
export function createExpiryChain(): ExpiryChain {
  const env = getEnv();
  const publicClient = createPublicClient({ chain: polygonAmoy, transport: transport() });

  return {
    configured: () => Boolean(env.FACTORY_OWNER_KEY),

    async readRefund(vault, donor) {
      const address = vault as `0x${string}`;
      const who = donor as `0x${string}`;
      try {
        const [closed, amount, claimed] = await Promise.all([
          publicClient.readContract({ address, abi: vaultAbi, functionName: "closed" }),
          publicClient.readContract({ address, abi: vaultAbi, functionName: "refundOf", args: [who] }),
          publicClient.readContract({ address, abi: vaultAbi, functionName: "refundClaimed", args: [who] }),
        ]);
        return { closed, claimed, amount: amount.toString() };
      } catch {
        return null; // includes a vault published before expiry existed, which has none of these functions
      }
    },

    async close(vault): Promise<Tx> {
      if (!env.FACTORY_OWNER_KEY) return { ok: false, error: "The sponsor wallet is not configured." };
      let hash: `0x${string}` | undefined;
      try {
        const account = privateKeyToAccount(env.FACTORY_OWNER_KEY as `0x${string}`);
        const call = { address: vault as `0x${string}`, abi: vaultAbi, functionName: "close" } as const;
        await publicClient.simulateContract({ ...call, account });
        return await withSponsorLock(async () => {
          const gasPrice = await publicClient.getGasPrice();
          const tooExpensive = gasPriceRefusal(gasPrice);
          if (tooExpensive) return { ok: false, error: tooExpensive } as const;
          const wallet = createWalletClient({ account, chain: polygonAmoy, transport: transport() });
          hash = await wallet.writeContract(call);
          const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
          return receipt.status === "success" ? ({ ok: true, txHash: hash } as const) : ({ ok: false, error: "The transaction was reverted by the contract." } as const);
        });
      } catch (err) {
        return hash ? { ok: false, error: explainExpiryError(err), pending: true } : { ok: false, error: explainExpiryError(err) };
      }
    },

    async claimRefund(signer: Signer, vault): Promise<Tx> {
      let hash: `0x${string}` | undefined;
      try {
        const account = privateKeyToAccount(decryptSecret(signer.keyEnc, env.WALLET_ENCRYPTION_KEY) as `0x${string}`);
        if (account.address.toLowerCase() !== signer.address.toLowerCase()) {
          return { ok: false, error: "The stored wallet key does not match this account's address." };
        }
        const call = { address: vault as `0x${string}`, abi: vaultAbi, functionName: "claimRefund" } as const;
        await publicClient.simulateContract({ ...call, account });

        const gas = await publicClient.estimateContractGas({ ...call, account }).catch(() => FALLBACK_GAS);
        const gasPrice = await publicClient.getGasPrice();
        const tooExpensive = gasPriceRefusal(gasPrice);
        if (tooExpensive) return { ok: false, error: tooExpensive };
        // Same 1.5x funding / 1.2x limit pair as the other sponsored sends.
        const funded = await topUpGas(signer.address, (gas * gasPrice * 15n) / 10n, { wait: true });
        if (!funded.ok) return { ok: false, error: funded.error };

        const wallet = createWalletClient({ account, chain: polygonAmoy, transport: transport() });
        hash = await wallet.writeContract({ ...call, gas: (gas * 12n) / 10n });
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
        return receipt.status === "success" ? { ok: true, txHash: hash } : { ok: false, error: "The transaction was reverted by the contract." };
      } catch (err) {
        return hash ? { ok: false, error: explainExpiryError(err), pending: true } : { ok: false, error: explainExpiryError(err) };
      }
    },
  };
}

let cached: ExpiryChain | undefined;
/** The shared real chain; routes use this and tests pass their own fake. */
export function expiryChain(): ExpiryChain {
  return (cached ??= createExpiryChain());
}
