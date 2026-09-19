import { requireUser } from "@/lib/api/guards";
import { escrowChain } from "@/lib/chain/manager";
import { getDb } from "@/lib/db";
import { releaseMilestone } from "@/lib/escrow/councilWorkflow";
import { escrowError, limited } from "@/lib/escrow/http";

/** POST /api/v1/milestones/:id/release: pay out a verified (and, above the limit, council-approved) milestone. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const blocked = limited(request);
  if (blocked) return blocked;

  const { id } = await params;
  const result = await releaseMilestone(getDb(), escrowChain(), auth.user, id);
  if (!result.ok) return escrowError(result);
  return Response.json({ executed: true, milestone: result.milestone });
}
