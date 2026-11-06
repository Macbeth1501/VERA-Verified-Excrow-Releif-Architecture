/**
 * Beyond this many blocks behind the chain head (about two minutes on Amoy) the dashboard says
 * the data is lagging, instead of silently serving it as current (SPDD 9.5).
 */
export const LAG_WARNING_BLOCKS = 60;

/** How up to date indexed data is: current, lagging behind the chain, unknown, or off (indexer not configured). */
export type Freshness = "current" | "lagging" | "unknown" | "off";

/** Classifies freshness from whether the indexer is configured and how many blocks it lags the chain head. */
export function freshness(configured: boolean, lagBlocks: number | null): Freshness {
  if (!configured) return "off";
  if (lagBlocks === null) return "unknown";
  return lagBlocks > LAG_WARNING_BLOCKS ? "lagging" : "current";
}
