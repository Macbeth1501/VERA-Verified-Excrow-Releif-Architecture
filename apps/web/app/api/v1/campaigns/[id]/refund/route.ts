import { requireUser } from "@/lib/api/guards";
import { expiryChain } from "@/lib/chain/expiry";
import { getDb } from "@/lib/db";
import { expiryError, limited } from "@/lib/expiry/http";
import { claimRefund, refundFor } from "@/lib/expiry/service";

/** GET /api/v1/campaigns/:id/refund: what the signed-in donor can claim from this campaign right now. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  const result = await refundFor(getDb(), expiryChain(), auth.user, id);
  if (!result.ok) return expiryError(result);
  return Response.json({ refund: result.refund }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/v1/campaigns/:id/refund: the donor takes their share, sent from their own wallet. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const blocked = limited(request);
  if (blocked) return blocked;

  const { id } = await params;
  const result = await claimRefund(getDb(), expiryChain(), auth.user, id);
  if (!result.ok) return expiryError(result);
  return Response.json({ claimed: true, txHash: result.txHash });
}
