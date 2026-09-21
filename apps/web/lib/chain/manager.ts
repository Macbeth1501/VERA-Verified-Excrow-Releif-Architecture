import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, fallback, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { decryptSecret } from "../auth/crypto";
import { getEnv, parseRpcUrls } from "../env";
import type { ChainStatus, EscrowChain, MilestoneState, OnSent, Signer, Tx } from "../escrow/chain-port";
import { gasPriceRefusal, topUpGas, withSponsorLock } from "./sponsor";

const managerAbi = parseAbi([
  "struct Milestone { uint256 targetPct; uint256 requiredAttestations; uint256 autoReleaseLimit; uint256 attestationCount; uint256 councilApprovals; uint8 status; }",
  "function defineMilestone(address vault, uint256 targetPct, uint256 requiredAttestations) returns (uint256 index)",
  "function submitAttestation(address vault, uint256 index, bytes32 proofHash)",
  "function councilApprove(address vault, uint256 index)",
  "function release(address vault, uint256 index)",
  "function setAttestor(address attestor, bool active)",
  "function setCouncilMember(address member, bool active)",
  "function milestoneCount(address vault) view returns (uint256)",
  "function getMilestone(address vault, uint256 index) view returns (Milestone)",
  "function releasableAmount(address vault, uint256 index) view returns (uint256)",
  "function councilThreshold() view returns (uint256)",
  "error NotAttestor()",
  "error NotCouncilMember()",
  "error NotVaultOrganizer()",
  "error VaultNotBoundToThisManager()",
  "error InvalidTargetPct(uint256 pct)",
  "error TargetPctExceeds100(uint256 total)",
  "error InvalidRequiredAttestations(uint256 m)",
  "error UnknownMilestone(uint256 index)",
  "error MilestoneAlreadyReleased()",
  "error MilestoneNotVerified()",
  "error AlreadyAttested()",
  "error AlreadyApproved()",
  "error OrganizerCannotAttest()",
  "error MilestonesNotFullyDefined(uint256 definedPct)",
  "error OutOfOrder(uint256 expectedIndex)",
  "error InsufficientCouncilApprovals(uint256 have, uint256 need)",
  "error NothingToRelease()",
  "error VaultPaused()",
  "error InsufficientVaultBalance(uint256 requested, uint256 available)",
]);
const vaultAbi = parseAbi(["function milestoneManager() view returns (address)"]);

/** Used only if gas estimation is refused. Real calls need roughly 60,000 to 150,000. */
const FALLBACK_GAS = 250_000n;
const STATUS: ChainStatus[] = ["Pending", "Verified", "Released"];

/** Plain-language reasons for the contract's custom errors. */
const REASONS: Record<string, string> = {
  NotAttestor: "This wallet is not registered as an attestor on the contract.",
  NotCouncilMember: "This wallet is not registered as a council member on the contract.",
  NotVaultOrganizer: "Only the campaign's organizer can define its milestones.",
  VaultNotBoundToThisManager: "This campaign's vault was created before the current milestone manager existed, so it can never release funds.",
  InvalidTargetPct: "A milestone's share must be between 1 and 100 percent.",
  TargetPctExceeds100: "The milestone shares would total more than 100 percent.",
  InvalidRequiredAttestations: "Each milestone needs at least 2 independent confirmations.",
  UnknownMilestone: "That milestone is not defined on the contract yet.",
  MilestoneAlreadyReleased: "This milestone has already been released.",
  MilestoneNotVerified: "This milestone has not reached its required number of confirmations yet.",
  AlreadyAttested: "This attestor has already confirmed this milestone.",
  AlreadyApproved: "This council member has already approved this release.",
  OrganizerCannotAttest: "A campaign's organizer cannot confirm their own milestone.",
  MilestonesNotFullyDefined: "The campaign's milestones do not total 100% on the contract yet.",
  OutOfOrder: "Earlier milestones must be released first.",
  InsufficientCouncilApprovals: "This payout is above the automatic limit and needs more council approvals.",
  NothingToRelease: "There is nothing to release yet: the campaign has raised nothing beyond what was already paid.",
  VaultPaused: "The campaign's vault is paused.",
  InsufficientVaultBalance: "The vault does not hold enough to pay this milestone.",
};

function transport() {
  return fallback(parseRpcUrls(getEnv().RPC_URL).map((url) => http(url, { timeout: 20_000, retryCount: 1 })));
}

/** A short, human message; unknown contract errors and RPC failures fall back to their first line. */
export function explain(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      return REASONS[revert.data.errorName] ?? `The contract refused this (${revert.data.errorName}).`;
    }
  }
  return err instanceof Error ? err.message.split("\n")[0].slice(0, 200) : "unknown error";
}

/**
 * The real MilestoneManager chain. Every signed call is sent from the ACTOR's own generated wallet
 * (organizer, attestor, council member), so on-chain the action truly comes from them; the platform
 * only sponsors gas. Releases and role changes come from the sponsor wallet (the contract owner),
 * queued behind the sponsor lock. Never throws.
 */
export function createEscrowChain(): EscrowChain {
  const env = getEnv();
  const manager = env.MILESTONE_MANAGER_ADDRESS as `0x${string}` | undefined;
  const publicClient = createPublicClient({ chain: polygonAmoy, transport: transport() });

  /** Fund gas, send, save the hash, then wait. A failure after sending stays "pending", never failed. */
  async function sendAs(
    signer: Signer,
    functionName: "defineMilestone" | "submitAttestation" | "councilApprove",
    args: readonly unknown[],
    onSent: OnSent,
  ): Promise<Tx> {
    if (!manager) return { ok: false, error: "The milestone manager is not configured." };
    let hash: `0x${string}` | undefined;
    try {
      const account = privateKeyToAccount(decryptSecret(signer.keyEnc, env.WALLET_ENCRYPTION_KEY) as `0x${string}`);
      if (account.address.toLowerCase() !== signer.address.toLowerCase()) {
        return { ok: false, error: "The stored wallet key does not match this account's address." };
      }
      // Fail with the contract's own reason before spending any gas.
      await publicClient.simulateContract({ address: manager, abi: managerAbi, functionName, args: args as never, account });

      // Fund only what this call needs (its own estimate plus a margin), not a flat allowance:
      // sponsor POL is scarce and whatever is left over stays in the actor's wallet.
      const gas = await publicClient
        .estimateContractGas({ address: manager, abi: managerAbi, functionName, args: args as never, account })
        .catch(() => FALLBACK_GAS);
      const gasPrice = await publicClient.getGasPrice();
      const tooExpensive = gasPriceRefusal(gasPrice);
      if (tooExpensive) return { ok: false, error: tooExpensive };
      // Fund above what the gas limit below can cost. The node checks the balance against
      // `gasLimit * maxFeePerGas`, and viem sets maxFeePerGas higher than `getGasPrice()`
      // (1.2x the base fee plus the priority fee), so funding exactly the limit's cost at
      // `gasPrice` leaves no headroom and a wallet with no POL of its own is refused on its
      // very first action. Same 1.5x / 1.2x pair as `campaigns.ts`.
      const funded = await topUpGas(signer.address, (gas * gasPrice * 15n) / 10n, { wait: true });
      if (!funded.ok) return { ok: false, error: funded.error };

      const wallet = createWalletClient({ account, chain: polygonAmoy, transport: transport() });
      hash = await wallet.writeContract({ address: manager, abi: managerAbi, functionName, args: args as never, gas: (gas * 12n) / 10n });
      onSent(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
      return receipt.status === "success" ? { ok: true, txHash: hash } : { ok: false, error: "The transaction was reverted by the contract." };
    } catch (err) {
      return hash ? { ok: false, error: explain(err), pending: true } : { ok: false, error: explain(err) };
    }
  }

  /** Sponsor-owned sends (release, role changes), queued so they cannot race for a nonce. */
  async function sendAsSponsor(functionName: "release" | "setAttestor" | "setCouncilMember", args: readonly unknown[], onSent: OnSent): Promise<Tx> {
    if (!manager || !env.FACTORY_OWNER_KEY) return { ok: false, error: "The milestone manager or the sponsor wallet is not configured." };
    let hash: `0x${string}` | undefined;
    try {
      const account = privateKeyToAccount(env.FACTORY_OWNER_KEY as `0x${string}`);
      await publicClient.simulateContract({ address: manager, abi: managerAbi, functionName, args: args as never, account });
      return await withSponsorLock(async () => {
        const wallet = createWalletClient({ account, chain: polygonAmoy, transport: transport() });
        hash = await wallet.writeContract({ address: manager, abi: managerAbi, functionName, args: args as never });
        onSent(hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
        return receipt.status === "success" ? ({ ok: true, txHash: hash } as const) : ({ ok: false, error: "The transaction was reverted by the contract." } as const);
      });
    } catch (err) {
      return hash ? { ok: false, error: explain(err), pending: true } : { ok: false, error: explain(err) };
    }
  }

  return {
    configured: () => Boolean(manager && env.FACTORY_OWNER_KEY),

    async vaultBound(vault) {
      if (!manager) return null;
      try {
        const bound = await publicClient.readContract({ address: vault as `0x${string}`, abi: vaultAbi, functionName: "milestoneManager" });
        return bound.toLowerCase() === manager.toLowerCase();
      } catch {
        return null;
      }
    },

    async definedCount(vault) {
      if (!manager) return null;
      try {
        return Number(await publicClient.readContract({ address: manager, abi: managerAbi, functionName: "milestoneCount", args: [vault as `0x${string}`] }));
      } catch {
        return null;
      }
    },

    async readMilestone(vault, index): Promise<MilestoneState | null> {
      if (!manager) return null;
      try {
        const v = vault as `0x${string}`;
        const i = BigInt(index);
        const [m, threshold, releasable] = await Promise.all([
          publicClient.readContract({ address: manager, abi: managerAbi, functionName: "getMilestone", args: [v, i] }),
          publicClient.readContract({ address: manager, abi: managerAbi, functionName: "councilThreshold" }),
          publicClient.readContract({ address: manager, abi: managerAbi, functionName: "releasableAmount", args: [v, i] }),
        ]);
        return {
          status: STATUS[Number(m.status)] ?? "Pending",
          attestationCount: Number(m.attestationCount),
          requiredAttestations: Number(m.requiredAttestations),
          councilApprovals: Number(m.councilApprovals),
          councilThreshold: Number(threshold),
          autoReleaseLimit: m.autoReleaseLimit.toString(),
          releasableAmount: releasable.toString(),
        };
      } catch {
        return null; // includes UnknownMilestone: not defined yet
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

    defineMilestone: (signer, vault, targetPct, required, onSent) =>
      sendAs(signer, "defineMilestone", [vault, BigInt(targetPct), BigInt(required)], onSent),
    submitAttestation: (signer, vault, index, proofHash, onSent) =>
      sendAs(signer, "submitAttestation", [vault, BigInt(index), proofHash], onSent),
    councilApprove: (signer, vault, index, onSent) => sendAs(signer, "councilApprove", [vault, BigInt(index)], onSent),
    release: (vault, index, onSent) => sendAsSponsor("release", [vault, BigInt(index)], onSent),
    setRole: (kind, address, active) =>
      sendAsSponsor(kind === "attestor" ? "setAttestor" : "setCouncilMember", [address, active], () => undefined),
  };
}

let cached: EscrowChain | undefined;
/** The shared real chain; routes use this and tests pass their own fake. */
export function escrowChain(): EscrowChain {
  return (cached ??= createEscrowChain());
}
