import { requireUser } from "@/lib/api/guards";
import { expiryChain } from "@/lib/chain/expiry";
import { getDb } from "@/lib/db";
import { expiryError, limited } from "@/lib/expiry/http";
import { closeCampaign } from "@/lib/expiry/service";

/**
 * POST /api/v1/campaigns/:id/close: close an expired, stalled or finished campaign so its donors can
 * claim back what is still held. Anyone signed in may ask; the vault refuses unless it is really closable.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const blocked = limited(request);
  if (blocked) return blocked;

  const { id } = await params;
  const result = await closeCampaign(getDb(), expiryChain(), id);
  if (!result.ok) return expiryError(result);
  return Response.json({ closed: true, txHash: result.txHash });
}
