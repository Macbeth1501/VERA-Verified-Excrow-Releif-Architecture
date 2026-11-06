import { apiError } from "@/lib/api/errors";
import { readJson, requireUser } from "@/lib/api/guards";
import { escrowChain } from "@/lib/chain/manager";
import { escrowError, limited } from "@/lib/escrow/http";
import { getReleaseLimit, setReleaseLimit } from "@/lib/escrow/limits";
import { releaseLimitSchema } from "@/lib/escrow/validation";

/**
 * GET /api/v1/admin/release-limit: the manager's current council-approval limit, read from the
 * chain. 503 when the chain cannot be read: a guessed value is never returned. Admin only.
 */
export async function GET(request: Request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const { configured, limitMinorUnits } = await getReleaseLimit(escrowChain());
  if (configured && limitMinorUnits === null) {
    return apiError(503, "CHAIN_UNAVAILABLE", "The council-approval limit could not be read from the blockchain right now.");
  }
  return Response.json({ limitMinorUnits, configured });
}

/**
 * POST /api/v1/admin/release-limit { limitRupees }: change the limit. It applies only to campaigns
 * published afterwards (each milestone keeps the limit it was defined with). Admin only.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const blocked = limited(request);
  if (blocked) return blocked;

  const json = await readJson(request);
  if (json.response) return json.response;
  const parsed = releaseLimitSchema.safeParse(json.body);
  if (!parsed.success) return apiError(400, "VALIDATION_FAILED", "Please check the limit.", parsed.error.flatten().fieldErrors);

  const result = await setReleaseLimit(escrowChain(), parsed.data.limitRupees);
  if (!result.ok) return escrowError(result);
  return Response.json({ limitMinorUnits: parsed.data.limitRupees, txHash: result.txHash, pending: result.pending });
}
