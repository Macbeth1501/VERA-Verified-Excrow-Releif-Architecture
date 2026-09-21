import { requireUser } from "@/lib/api/guards";
import { beneficiaryError } from "@/lib/beneficiary/http";
import { getProgramSalt } from "@/lib/beneficiary/service";
import { getDb } from "@/lib/db";

/**
 * GET /api/v1/campaigns/:id/beneficiaries/salt: the campaign's random salt, which the browser mixes
 * into each beneficiary fingerprint (SPDD 17.2). Only the campaign's organizer or an admin gets it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request, "organizer", "admin");
  if (auth.response) return auth.response;
  const { id } = await params;
  const result = getProgramSalt(getDb(), auth.user, id);
  return result.ok ? Response.json({ salt: result.salt }) : beneficiaryError(result);
}
