import { parseUnits } from "viem";
import { MINR_DECIMALS } from "../campaigns/money";

/** Sanity cap on the council-approval limit, in rupees. Pure and browser-safe (shared by the form and the API). */
export const MAX_RELEASE_LIMIT_RUPEES = 10_000_000;

/**
 * Rupees typed by the admin ("250.5") to mINR minor units ("250500000"). Whole rupees or at most
 * two decimals, 0 allowed (every release then needs the council), capped at 10,000,000. Null when unusable.
 */
export function releaseLimitToMinorUnits(input: string): string | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  if (Number(trimmed) > MAX_RELEASE_LIMIT_RUPEES) return null;
  return parseUnits(trimmed, MINR_DECIMALS).toString();
}
