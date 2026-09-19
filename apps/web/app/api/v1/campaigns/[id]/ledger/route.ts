import { apiError } from "@/lib/api/errors";
import { buildDashboard } from "@/lib/campaigns/dashboard";
import { getDb } from "@/lib/db";
import { indexerRuntime } from "@/lib/indexer/runtime";

/**
 * GET /api/v1/campaigns/:id/ledger: everything the public dashboard shows, as JSON, for a LIVE
 * campaign (SPDD 12.2, FR-LDG-01). Includes "data as of block N" and the reconciliation result
 * so a stale or unverified view is never presented as current.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await buildDashboard(getDb(), indexerRuntime(), id);
  if (!data) return apiError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");
  return Response.json(data);
}
