import { apiError } from "@/lib/api/errors";
import { isEventName } from "@/lib/activity/activity";
import { buildActivity, knownContractsFromEnv } from "@/lib/activity/load";
import { getDb } from "@/lib/db";
import { indexerRuntime } from "@/lib/indexer/runtime";

/**
 * GET /api/v1/activity: every indexed on-chain event across all campaigns and contracts, newest
 * first, with a plain-language sentence and the transaction hash for each. Public, like the
 * campaign ledger: it is a projection of data anyone can read on a block explorer.
 *
 * Query: `campaign` (campaign id), `type` (an event name), `limit` (1-200, default 50), `offset`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (type !== null && type !== "" && !isEventName(type)) return apiError(400, "VALIDATION_FAILED", "Unknown event type.");
  const number = (name: string) => {
    const raw = url.searchParams.get(name);
    return raw === null || raw === "" ? undefined : Number(raw);
  };
  const limit = number("limit");
  const offset = number("offset");
  if ((limit !== undefined && !Number.isFinite(limit)) || (offset !== undefined && !Number.isFinite(offset))) {
    return apiError(400, "VALIDATION_FAILED", "limit and offset must be numbers.");
  }

  const data = await buildActivity(getDb(), indexerRuntime(), knownContractsFromEnv(), {
    campaignId: url.searchParams.get("campaign") || undefined,
    type: type && isEventName(type) ? type : undefined,
    limit,
    offset,
  });
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}
