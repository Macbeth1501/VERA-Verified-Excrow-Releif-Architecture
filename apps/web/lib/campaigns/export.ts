import { formatUnits } from "viem";
import { explorerAddressUrl, explorerTxUrl } from "../explorer";
import { MINR_DECIMALS } from "./money";
import type { DashboardData } from "./dashboard";

/**
 * Quotes a CSV field when needed and neutralises spreadsheet formula injection: a cell starting
 * with = + - or @ is prefixed with an apostrophe so Excel and Sheets treat it as text.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const HEADER = ["timestamp_utc", "block", "event", "tx_hash", "address", "amount_minor_units", "amount_inr", "explorer_tx_url"];

/** The full audit trail as CSV: one row per on-chain event, oldest first, with explorer links. */
export function ledgerToCsv(data: DashboardData): string {
  const rows = data.ledger.map((e) => [
    e.timestamp,
    String(e.blockNumber),
    e.type,
    e.txHash,
    e.actor,
    e.amount ?? "",
    e.amount === null ? "" : formatUnits(BigInt(e.amount), MINR_DECIMALS),
    explorerTxUrl(e.txHash),
  ]);
  return [HEADER, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/** JSON export: the same data as the dashboard plus how to verify it independently. */
export function ledgerToJson(data: DashboardData) {
  return {
    ...data,
    verifyYourself: {
      vaultAddress: data.vault,
      vaultOnExplorer: explorerAddressUrl(data.vault),
      howTo:
        "Open vaultOnExplorer, check the mINR token balance held by the vault, and compare it with escrow.heldMinorUnits (6 decimals). Each ledger entry links to its transaction.",
    },
  };
}

/** A filesystem-safe file name for downloads. */
export function exportFileName(title: string, extension: "csv" | "json"): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "campaign";
  return `vera-${slug}-ledger.${extension}`;
}
