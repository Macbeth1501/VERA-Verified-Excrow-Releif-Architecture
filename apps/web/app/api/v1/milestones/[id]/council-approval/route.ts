import { requireUser } from "@/lib/api/guards";
import { escrowChain } from "@/lib/chain/manager";
import { getDb } from "@/lib/db";
import { councilApprove } from "@/lib/escrow/councilWorkflow";
import { escrowError, limited } from "@/lib/escrow/http";

/** POST /api/v1/milestones/:id/council-approval (FR-GOV-01): a council member approves a verified milestone's release. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request, "council");
  if (auth.response) return auth.response;
  const blocked = limited(request);
  if (blocked) return blocked;

  const { id } = await params;
  const result = await councilApprove(getDb(), escrowChain(), auth.user, id);
  if (!result.ok) return escrowError(result);
  const { state } = result.milestone;
  return Response.json({
    signatures_collected: state?.councilApprovals ?? 0,
    threshold: state?.councilThreshold ?? 0,
    milestone: result.milestone,
  });
}
