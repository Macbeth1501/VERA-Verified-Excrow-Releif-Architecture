/** Pure and browser-safe: shared by the admin form and the API. The contract floor is `MIN_COUNCIL_THRESHOLD = 2`. */
export const MIN_COUNCIL_THRESHOLD = 2;

/** What a change of K does to one milestone that is waiting for council approvals. */
export type ThresholdEffect = { kind: "releasable" } | { kind: "needs_more"; more: number };

/** Releasable once approvals reach K; otherwise how many more approvals are needed. */
export function thresholdEffect(approvals: number, newThreshold: number): ThresholdEffect {
  return approvals >= newThreshold ? { kind: "releasable" } : { kind: "needs_more", more: newThreshold - approvals };
}

/** Plain sentence for the admin's confirmation list. */
export function describeEffect(approvals: number, newThreshold: number): string {
  const e = thresholdEffect(approvals, newThreshold);
  return e.kind === "releasable" ? "now releasable" : `now needs ${e.more} more approval${e.more === 1 ? "" : "s"}`;
}

/** Why K cannot be set to this value, or null when it can. `councilMembers` = active, synced members. */
export function thresholdRefusal(threshold: number, councilMembers: number): string | null {
  if (!Number.isInteger(threshold) || threshold < MIN_COUNCIL_THRESHOLD) {
    return `The council needs at least ${MIN_COUNCIL_THRESHOLD} approvals: no single person may move a large sum.`;
  }
  if (councilMembers < MIN_COUNCIL_THRESHOLD) {
    return `Only ${councilMembers} council member${councilMembers === 1 ? " is" : "s are"} registered; add more before changing the number.`;
  }
  if (threshold > councilMembers) {
    return `Only ${councilMembers} council member${councilMembers === 1 ? " is" : "s are"} registered, so ${threshold} approvals could never be reached and every large release would freeze. Add council members or choose ${councilMembers} or fewer.`;
  }
  return null;
}
