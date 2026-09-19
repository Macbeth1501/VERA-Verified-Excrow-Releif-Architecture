import { apiError } from "@/lib/api/errors";
import { escrowChain } from "@/lib/chain/manager";
import { getDb } from "@/lib/db";
import { loadMilestone, viewMilestone } from "@/lib/escrow/service";

/** GET /api/v1/milestones/:id: a milestone with its state as the contract reports it. Public. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const ctx = loadMilestone(db, id);
  if (!ctx) return apiError(404, "MILESTONE_NOT_FOUND", "Milestone not found, or its campaign is not live.");
  return Response.json({ milestone: await viewMilestone(db, escrowChain(), ctx) });
}
