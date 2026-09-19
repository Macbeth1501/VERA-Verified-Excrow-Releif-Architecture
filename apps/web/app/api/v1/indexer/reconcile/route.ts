import { apiError } from "@/lib/api/errors";
import { getDb } from "@/lib/db";
import { reconcileVault, type ReconciliationRow } from "@/lib/indexer/queries";
import { indexerRuntime, syncIfStale } from "@/lib/indexer/runtime";
import { knownVaults } from "@/lib/indexer/store";

/**
 * GET /api/v1/indexer/reconcile: compares every figure derived from indexed events with the
 * chain itself, at the same block, with zero tolerance (SPDD 21, NFR-17). Public: anyone can
 * independently verify the same numbers with a block explorer.
 */
export async function GET() {
  const runtime = indexerRuntime();
  if (!runtime) return apiError(409, "INDEXER_NOT_CONFIGURED", "The indexer is off.");
  const db = getDb();
  await syncIfStale(db, runtime);

  const rows: Array<ReconciliationRow | { vault: string; error: string }> = [];
  for (const { vault } of knownVaults(db)) {
    try {
      const row = await reconcileVault(db, runtime.reader, vault);
      if (row) rows.push(row);
    } catch {
      rows.push({ vault, error: "Could not read the vault balance from the chain at that block." });
    }
  }
  const checked = rows.filter((r): r is ReconciliationRow => "match" in r);
  return Response.json({
    allMatch: rows.length > 0 && checked.length === rows.length && checked.every((r) => r.match),
    vaults: rows,
  });
}
