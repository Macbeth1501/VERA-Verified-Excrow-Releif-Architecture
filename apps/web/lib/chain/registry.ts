import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, fallback, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { decryptSecret } from "../auth/crypto";
import type { BeneficiaryChain } from "../beneficiary/chain-port";
import { getEnv, parseRpcUrls } from "../env";
import type { OnSent, Signer, Tx } from "../escrow/chain-port";
import { gasPriceRefusal, topUpGas } from "./sponsor";

const registryAbi = parseAbi([
  "function register(address vault, bytes32 identityHash, bytes32 photoHash) returns (uint256 index)",
  "function isRegistered(address vault, bytes32 identityHash) view returns (bool)",
  "error NotVaultOrganizer()",
  "error ZeroIdentityHash()",
  "error DuplicateBeneficiary(address vault, bytes32 identityHash)",
]);

/** Used only if gas estimation is refused. A registration costs roughly 70,000 gas. */
const FALLBACK_GAS = 150_000n;

/** Plain-language reasons for the contract's custom errors. */
const REASONS: Record<string, string> = {
  NotVaultOrganizer: "Only the campaign's organizer can register beneficiaries.",
  ZeroIdentityHash: "A beneficiary needs an identity fingerprint.",
  DuplicateBeneficiary: "This beneficiary is already registered for this campaign.",
};

function transport() {
  return fallback(parseRpcUrls(getEnv().RPC_URL).map((url) => http(url, { timeout: 20_000, retryCount: 1 })));
}

/** A short, human message; unknown contract errors and RPC failures fall back to their first line. */
export function explainRegistryError(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      return REASONS[revert.data.errorName] ?? `The contract refused this (${revert.data.errorName}).`;
    }
  }
  return err instanceof Error ? err.message.split("\n")[0].slice(0, 200) : "unknown error";
}

/**
 * The real BeneficiaryRegistry chain. The registration is sent from the campaign organizer's own
 * generated wallet, so on-chain it truly comes from them (the contract only accepts the vault's
 * organizer); the platform only sponsors gas. Never throws.
 */
export function createBeneficiaryChain(): BeneficiaryChain {
  const env = getEnv();
  const registry = env.BENEFICIARY_REGISTRY_ADDRESS as `0x${string}` | undefined;
  const publicClient = createPublicClient({ chain: polygonAmoy, transport: transport() });

  return {
    configured: () => Boolean(registry && env.FACTORY_OWNER_KEY),

    async isRegistered(vault, identityHash) {
      if (!registry) return null;
      try {
        return await publicClient.readContract({
          address: registry,
          abi: registryAbi,
          functionName: "isRegistered",
          args: [vault as `0x${string}`, identityHash as `0x${string}`],
        });
      } catch {
        return null;
      }
    },

    async txState(txHash) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
        return receipt.status === "success" ? "success" : "reverted";
      } catch {
        return "pending";
      }
    },

    async register(signer: Signer, vault: string, identityHash: string, photoHash: string, onSent: OnSent): Promise<Tx> {
      if (!registry) return { ok: false, error: "The beneficiary registry is not configured." };
      const args = [vault as `0x${string}`, identityHash as `0x${string}`, photoHash as `0x${string}`] as const;
      let hash: `0x${string}` | undefined;
      try {
        const account = privateKeyToAccount(decryptSecret(signer.keyEnc, env.WALLET_ENCRYPTION_KEY) as `0x${string}`);
        if (account.address.toLowerCase() !== signer.address.toLowerCase()) {
          return { ok: false, error: "The stored wallet key does not match this account's address." };
        }
        // Fail with the contract's own reason before spending any gas.
        await publicClient.simulateContract({ address: registry, abi: registryAbi, functionName: "register", args, account });

        const gas = await publicClient
          .estimateContractGas({ address: registry, abi: registryAbi, functionName: "register", args, account })
          .catch(() => FALLBACK_GAS);
        const gasPrice = await publicClient.getGasPrice();
        const tooExpensive = gasPriceRefusal(gasPrice);
        if (tooExpensive) return { ok: false, error: tooExpensive };
        // Fund above the limit's max cost (the node checks against maxFeePerGas): same 1.5x / 1.2x pair as manager.ts.
        const funded = await topUpGas(signer.address, (gas * gasPrice * 15n) / 10n, { wait: true });
        if (!funded.ok) return { ok: false, error: funded.error };

        const wallet = createWalletClient({ account, chain: polygonAmoy, transport: transport() });
        hash = await wallet.writeContract({ address: registry, abi: registryAbi, functionName: "register", args, gas: (gas * 12n) / 10n });
        onSent(hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
        return receipt.status === "success" ? { ok: true, txHash: hash } : { ok: false, error: "The transaction was reverted by the contract." };
      } catch (err) {
        return hash ? { ok: false, error: explainRegistryError(err), pending: true } : { ok: false, error: explainRegistryError(err) };
      }
    },
  };
}

let cached: BeneficiaryChain | undefined;
/** The shared real chain; routes use this and tests pass their own fake. */
export function beneficiaryChain(): BeneficiaryChain {
  return (cached ??= createBeneficiaryChain());
}
