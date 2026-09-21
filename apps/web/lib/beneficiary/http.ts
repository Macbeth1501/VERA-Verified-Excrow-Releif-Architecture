import { apiError } from "../api/errors";
import { allow } from "../api/rate-limit";
import type { BeneficiaryFailure } from "./service";

export const beneficiaryError = (f: BeneficiaryFailure) => apiError(f.status, f.code, f.message);

/**
 * Registration gets a stricter bucket than other mutating routes (SPDD 17.3) and is keyed per signed-in
 * identity, not per address: a burst of 5, then one every 6 seconds (10 a minute). That is plenty for a
 * field agent working through a queue and far too slow for bulk-fabricating ghost beneficiaries.
 */
export const limitedRegistrations = (userId: string) =>
  allow(`beneficiaries:${userId}`, { capacity: 5, refillPerSecond: 1 / 6 })
    ? null
    : apiError(429, "RATE_LIMITED", "Too many registrations too quickly. Please slow down and try again shortly.");
