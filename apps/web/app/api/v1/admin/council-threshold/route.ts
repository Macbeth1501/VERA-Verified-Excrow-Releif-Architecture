import { apiError } from "@/lib/api/errors";
import { readJson, requireUser } from "@/lib/api/guards";
import { escrowChain } from "@/lib/chain/manager";
import { getDb } from "@/lib/db";
import { escrowError, limited } from "@/lib/escrow/http";
import { getThreshold, setThreshold } from "@/lib/escrow/threshold";
import { thresholdSchema } from "@/lib/escrow/validation";

/**
 * GET /api/v1/admin/council-threshold: the current K read from the chain, the number of registered
 * council members and the milestones a change would affect. 503 when the chain cannot be read: a
 * guessed value is never returned. Admin only.
 */
export async function GET(request: Request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const result = await getThreshold(getDb(), escrowChain());
  if (result.configured && result.threshold === null) {
    return apiError(503, "CHAIN_UNAVAILABLE", "The council threshold could not be read from the blockchain right now.");
  }
  return Response.json(result);
}

/**
 * POST /api/v1/admin/council-threshold { threshold }: change K. Takes effect at once for milestones
 * already waiting for the council. Refused below 2 and above the number of registered council members. Admin only.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const blocked = limited(request);
  if (blocked) return blocked;

  const json = await readJson(request);
  if (json.response) return json.response;
  const parsed = thresholdSchema.safeParse(json.body);
  if (!parsed.success) return apiError(400, "VALIDATION_FAILED", "Please check the number.", parsed.error.flatten().fieldErrors);

  const result = await setThreshold(getDb(), escrowChain(), parsed.data.threshold);
  if (!result.ok) return escrowError(result);
  return Response.json({ threshold: parsed.data.threshold, txHash: result.txHash, pending: result.pending });
}
