import { apiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { allow } from "@/lib/api/rate-limit";
import { getDb } from "@/lib/db";
import { indexerRuntime } from "@/lib/indexer/runtime";
import { syncOnce } from "@/lib/indexer/sync";

/** POST /api/v1/indexer/sync: force a full pass now, regardless of staleness. Admin only. */
export async function POST(request: Request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  if (!allow(`indexer-sync:${auth.user.id}`, { capacity: 6, refillPerSecond: 6 / 60 })) {
    return apiError(429, "RATE_LIMITED", "Too many sync requests. Please wait a minute.");
  }

  const runtime = indexerRuntime();
  if (!runtime) {
    return apiError(409, "INDEXER_NOT_CONFIGURED", "Set FACTORY_ADDRESS and INDEXER_START_BLOCK to enable the indexer.");
  }
  return Response.json(await syncOnce(getDb(), runtime.reader, runtime.config));
}
