import { apiError } from "@/lib/api/errors";
import { readJson, requireUser } from "@/lib/api/guards";
import { escrowChain } from "@/lib/chain/manager";
import { getDb } from "@/lib/db";
import { escrowError } from "@/lib/escrow/http";
import { listRoleGrants, setRole } from "@/lib/escrow/service";
import { roleSchema } from "@/lib/escrow/validation";

/** GET /api/v1/admin/roles: every attestor and council member and whether the contract knows them. Admin only. */
export async function GET(request: Request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  return Response.json({ grants: listRoleGrants(getDb()) });
}

/**
 * POST /api/v1/admin/roles: make an account an attestor or council member (or remove the role).
 * The database change is saved first and mirrored on the MilestoneManager; repeat the call to
 * retry a failed mirror. Admin only.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;

  const json = await readJson(request);
  if (json.response) return json.response;
  const parsed = roleSchema.safeParse(json.body);
  if (!parsed.success) return apiError(400, "VALIDATION_FAILED", "Please check the email and role.", parsed.error.flatten().fieldErrors);

  const result = await setRole(getDb(), escrowChain(), parsed.data);
  if (!result.ok) return escrowError(result);
  return Response.json({ grant: result.grant });
}
