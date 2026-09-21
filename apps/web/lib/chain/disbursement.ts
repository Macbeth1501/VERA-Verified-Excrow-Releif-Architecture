import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, fallback, http, parseAbi, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { decryptSecret } from "../auth/crypto";
import type { DisbursementChain } from "../disbursement/chain-port";
import { getEnv, parseRpcUrls } from "../env";
import type { OnSent, Signer, Tx } from "../escrow/chain-port";
import { gasPriceRefusal, topUpGas } from "./sponsor";

const disbursementAbi = parseAbi([
  "function disburse(address vault, uint256 milestoneIndex, bytes32 identityHash, uint256 amount, bytes32 payoutRef)",
  "function manager() view returns (address)",
  "function isDisbursed(address vault, uint256 index) view returns (bool)",
  "function payableRemaining(address vault) view returns (uint256)",
  "error ZeroAddress()",
  "error NotVaultOrganizer()",
  "error VaultNotBoundToThisManager()",
  "error MilestoneNotReleased()",
  "error MilestoneAlreadyDisbursed()",
  "error BeneficiaryNotRegistered()",
  "error ZeroAmount()",
  "error MissingPayoutReference()",
  "error ExceedsReleased(uint256 requested, uint256 available)",
  // Raised by the mINR token (OpenZeppelin v5) inside `safeTransferFrom`.
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
]);
const tokenAbi = parseAbi([
  "function approve(address spender, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "error ERC20InvalidSpender(address spender)",
]);
const managerAbi = parseAbi([
  "struct Milestone { uint256 targetPct; uint256 requiredAttestations; uint256 autoReleaseLimit; uint256 attestationCount; uint256 councilApprovals; uint8 status; }",
  "function milestoneCount(address vault) view returns (uint256)",
  "function getMilestone(address vault, uint256 index) view returns (Milestone)",
]);

/** Used only if gas estimation is refused. An approve is about 46,000 gas and a disburse about 110,000. */
const FALLBACK_GAS = 200_000n;
/** MilestoneManager.Status.Released. */
const RELEASED = 2;

/** Plain-language reasons for the contracts' custom errors. */
const REASONS: Record<string, string> = {
  NotVaultOrganizer: "Only the campaign's organizer can record a payout.",
  VaultNotBoundToThisManager: "This campaign's vault is not bound to the milestone manager the payout contract checks, so it cannot be paid out through it.",
  MilestoneNotReleased: "This milestone has not been released yet.",
  MilestoneAlreadyDisbursed: "This milestone's payout has already been recorded.",
  BeneficiaryNotRegistered: "That beneficiary is not registered for this campaign.",
  ZeroAmount: "A payout needs an amount.",
  MissingPayoutReference: "A payout needs an off-ramp reference.",
  ExceedsReleased: "The payout is more than this campaign has released and not yet paid out.",
  ERC20InsufficientBalance: "The organizer's wallet does not hold enough mINR for this payout.",
  ERC20InsufficientAllowance: "The organizer has not approved the payout amount yet.",
  ERC20InvalidSpender: "The payout contract address is invalid.",
};

function transport() {
  return fallback(parseRpcUrls(getEnv().RPC_URL).map((url) => http(url, { timeout: 20_000, retryCount: 1 })));
}

/** A short, human message; unknown contract errors and RPC failures fall back to their first line. */
export function explainDisbursementError(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      return REASONS[revert.data.errorName] ?? `The contract refused this (${revert.data.errorName}).`;
    }
  }
  return err instanceof Error ? err.message.split("\n")[0].slice(0, 200) : "unknown error";
}

/**
 * The real Disbursement chain. Both transactions (the token approval and the payout itself) are sent
 * from the campaign organizer's own generated wallet, which is where the manager paid the release;
 * the contract only accepts the vault's organizer. The platform only sponsors gas. Never throws.
 */
export function createDisbursementChain(): DisbursementChain {
  const env = getEnv();
  const disbursement = env.DISBURSEMENT_ADDRESS as `0x${string}` | undefined;
  const token = env.MOCK_INR_ADDRESS as `0x${string}`;
  const publicClient = createPublicClient({ chain: polygonAmoy, transport: transport() });
  // The manager the Disbursement contract itself checks against (immutable), read once.
  let managerAddress: Promise<`0x${string}`> | undefined;
  const manager = () =>
    (managerAddress ??= publicClient.readContract({ address: disbursement!, abi: disbursementAbi, functionName: "manager" }).catch((err) => {
      managerAddress = undefined;
      throw err;
    }));

  /**
   * Simulate (so a refusal becomes the contract's own reason before any gas is spent), estimate, fund
   * the signer at 1.5x the estimate's cost, send with a 1.2x gas limit, save the hash, then wait.
   */
  async function send(signer: Signer, address: `0x${string}`, abi: Abi, functionName: string, args: readonly unknown[], onSent: OnSent): Promise<Tx> {
    let hash: `0x${string}` | undefined;
    try {
      const account = privateKeyToAccount(decryptSecret(signer.keyEnc, env.WALLET_ENCRYPTION_KEY) as `0x${string}`);
      if (account.address.toLowerCase() !== signer.address.toLowerCase()) {
        return { ok: false, error: "The stored wallet key does not match this account's address." };
      }
      const call = { address, abi, functionName, args, account } as const;
      await publicClient.simulateContract(call);

      const gas = await publicClient.estimateContractGas(call).catch(() => FALLBACK_GAS);
      const gasPrice = await publicClient.getGasPrice();
      const tooExpensive = gasPriceRefusal(gasPrice);
      if (tooExpensive) return { ok: false, error: tooExpensive };
      // Fund above the limit's max cost (the node checks against maxFeePerGas): same 1.5x / 1.2x pair as manager.ts.
      const funded = await topUpGas(signer.address, (gas * gasPrice * 15n) / 10n, { wait: true });
      if (!funded.ok) return { ok: false, error: funded.error };

      const wallet = createWalletClient({ account, chain: polygonAmoy, transport: transport() });
      hash = await wallet.writeContract({ address, abi, functionName, args, gas: (gas * 12n) / 10n } as Parameters<typeof wallet.writeContract>[0]);
      onSent(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
      return receipt.status === "success" ? { ok: true, txHash: hash } : { ok: false, error: "The transaction was reverted by the contract." };
    } catch (err) {
      return hash ? { ok: false, error: explainDisbursementError(err), pending: true } : { ok: false, error: explainDisbursementError(err) };
    }
  }

  return {
    configured: () => Boolean(disbursement && env.FACTORY_OWNER_KEY),

    async readPayout(vault, index, organizer) {
      if (!disbursement) return null;
      const v = vault as `0x${string}`;
      const who = organizer as `0x${string}`;
      try {
        const mgr = await manager();
        const count = await publicClient.readContract({ address: mgr, abi: managerAbi, functionName: "milestoneCount", args: [v] });
        const [milestone, disbursed, payableRemaining, organizerBalance, allowance] = await Promise.all([
          BigInt(index) < count
            ? publicClient.readContract({ address: mgr, abi: managerAbi, functionName: "getMilestone", args: [v, BigInt(index)] })
            : Promise.resolve(null),
          publicClient.readContract({ address: disbursement, abi: disbursementAbi, functionName: "isDisbursed", args: [v, BigInt(index)] }),
          publicClient.readContract({ address: disbursement, abi: disbursementAbi, functionName: "payableRemaining", args: [v] }),
          publicClient.readContract({ address: token, abi: tokenAbi, functionName: "balanceOf", args: [who] }),
          publicClient.readContract({ address: token, abi: tokenAbi, functionName: "allowance", args: [who, disbursement] }),
        ]);
        return {
          released: milestone?.status === RELEASED,
          disbursed,
          payableRemaining: payableRemaining.toString(),
          organizerBalance: organizerBalance.toString(),
          allowance: allowance.toString(),
        };
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

    async approve(signer, amount, onSent) {
      if (!disbursement) return { ok: false, error: "The payout contract is not configured." };
      return send(signer, token, tokenAbi, "approve", [disbursement, BigInt(amount)], onSent);
    },

    async disburse(signer, vault, index, identityHash, amount, payoutRefHash, onSent) {
      if (!disbursement) return { ok: false, error: "The payout contract is not configured." };
      const args = [vault as `0x${string}`, BigInt(index), identityHash as `0x${string}`, BigInt(amount), payoutRefHash as `0x${string}`] as const;
      return send(signer, disbursement, disbursementAbi, "disburse", args, onSent);
    },
  };
}

let cached: DisbursementChain | undefined;
/** The shared real chain; routes use this and tests pass their own fake. */
export function disbursementChain(): DisbursementChain {
  return (cached ??= createDisbursementChain());
}
