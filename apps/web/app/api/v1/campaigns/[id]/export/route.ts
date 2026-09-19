import { apiError } from "@/lib/api/errors";
import { buildDashboard } from "@/lib/campaigns/dashboard";
import { exportFileName, ledgerToCsv, ledgerToJson } from "@/lib/campaigns/export";
import { getDb } from "@/lib/db";
import { indexerRuntime } from "@/lib/indexer/runtime";

/**
 * GET /api/v1/campaigns/:id/export?format=csv|json: the full public audit trail as a download
 * (FR-LDG-01). Public for LIVE campaigns, built from the same data as the dashboard.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (format !== "csv" && format !== "json") {
    return apiError(400, "VALIDATION_FAILED", "format must be csv or json.");
  }

  const data = await buildDashboard(getDb(), indexerRuntime(), id);
  if (!data) return apiError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");

  const filename = exportFileName(data.campaign.title, format);
  const headers = { "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" };
  if (format === "csv") {
    return new Response(ledgerToCsv(data), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  }
  return Response.json(ledgerToJson(data), { headers });
}
