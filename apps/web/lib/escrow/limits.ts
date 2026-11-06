import type { EscrowChain } from "./chain-port";
import { fail, type Outcome } from "./service";

/**
 * The global council-approval ("auto-release") limit on the MilestoneManager. Each milestone copies
 * the limit when it is defined, so a change only affects campaigns published afterwards; an admin
 * can never use it to skip the council on a milestone that already exists. Nothing is stored in the
 * database: the contract is the only source of truth.
 */

/** Reads the current limit. `configured: false` when escrow is off; a null limit means unreadable. */
export async function getReleaseLimit(chain: EscrowChain): Promise<{ configured: boolean; limitMinorUnits: string | null }> {
  if (!chain.configured()) return { configured: false, limitMinorUnits: null };
  return { configured: true, limitMinorUnits: await chain.readAutoReleaseLimit() };
}

/**
 * Sets the limit (minor units) from the sponsor wallet, which owns the manager. A sent transaction
 * whose outcome is unknown is reported as pending, never as failed.
 */
export async function setReleaseLimit(
  chain: EscrowChain,
  minorUnits: string,
): Promise<Outcome<{ txHash: string | null; pending: boolean }>> {
  if (!chain.configured()) return fail(503, "ESCROW_NOT_CONFIGURED", "The milestone manager is not configured on this server.");
  const tx = await chain.setAutoReleaseLimit(minorUnits);
  if (tx.ok) return { ok: true, txHash: tx.txHash, pending: false };
  if (tx.pending) return { ok: true, txHash: null, pending: true };
  return fail(502, "CHAIN_FAILED", `Could not change the limit on the contract: ${tx.error}`);
}
