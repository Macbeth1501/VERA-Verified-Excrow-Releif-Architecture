import { getDb } from "@/lib/db";
import { indexerRuntime, syncIfStale } from "@/lib/indexer/runtime";
import { indexerStatus } from "@/lib/indexer/queries";

/**
 * GET /api/v1/indexer/status: "data as of block N" (SPDD 9.5). Public. Triggers a refresh if the
 * data is stale, so simply viewing status keeps the indexer inside its lag window.
 */
export async function GET() {
  const runtime = indexerRuntime();
  if (!runtime) {
    return Response.json({
      configured: false,
      message: "The indexer is off. Set FACTORY_ADDRESS and INDEXER_START_BLOCK to enable it.",
    });
  }
  const db = getDb();
  const sync = await syncIfStale(db, runtime);
  const status = await indexerStatus(db, runtime.reader);
  return Response.json({
    configured: true,
    ...status,
    lastSyncErrors: sync?.errors ?? [],
    confirmations: runtime.config.confirmations,
  });
}
