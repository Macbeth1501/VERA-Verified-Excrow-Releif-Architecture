import { formatUnits, parseUnits } from "viem";

/** mINR uses 6 decimals (see MockINR.sol). */
export const MINR_DECIMALS = 6;

/**
 * Converts a rupee amount typed by a person ("1000", "1000.50") into integer minor units for
 * transport and storage, per SPDD §12.1. Returns null when the input is not a usable amount, so
 * the caller can show a validation message rather than sending a wrong number.
 */
export function rupeesToMinorUnits(input: string): string | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) return null;
  try {
    const raw = parseUnits(trimmed, MINR_DECIMALS);
    return raw > 0n ? raw.toString() : null;
  } catch {
    return null;
  }
}

/** Formats minor units as rupees for display, e.g. "1000000000" -> "₹1,000.00". */
export function formatMinorUnits(minorUnits: string): string {
  const value = Number(formatUnits(BigInt(minorUnits), MINR_DECIMALS));
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
