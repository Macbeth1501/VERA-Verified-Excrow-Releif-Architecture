import { apiError } from "@/lib/api/errors";
import { readJson, requireUser } from "@/lib/api/guards";
import { syncOrganizerVerification } from "@/lib/chain/factory";
import { getDb } from "@/lib/db";
import {
  AlreadyReviewedError,
  ProfileNotFoundError,
  decide,
  getProfileById,
  recordChainSync,
} from "@/lib/organizers/service";
import { decisionSchema } from "@/lib/organizers/validation";

/**
 * POST /api/v1/admin/organizers/:id/decision: approve or reject a pending application.
 * Admin only. The decision is saved first; an approval is then mirrored on-chain, and a chain
 * failure is recorded (and retryable) without undoing the decision.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;

  const json = await readJson(request);
  if (json.response) return json.response;
  const parsed = decisionSchema.safeParse(json.body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_FAILED", "Please check the decision.", parsed.error.flatten().fieldErrors);
  }

  const { id } = await params;
  const db = getDb();
  try {
    const decided = decide(db, id, auth.user.id, parsed.data.decision, parsed.data.reason);
    if (parsed.data.decision === "approve") {
      recordChainSync(db, id, await syncOrganizerVerification(decided.walletAddress));
    }
    const profile = getProfileById(db, id) ?? decided;
    return Response.json({ kyb_status: profile.kybStatus, profile });
  } catch (err) {
    if (err instanceof ProfileNotFoundError) return apiError(404, "ORGANIZER_NOT_FOUND", err.message);
    if (err instanceof AlreadyReviewedError) return apiError(409, "ALREADY_APPLIED", err.message, { kyb_status: err.status });
    console.error(JSON.stringify({ event: "kyb_decision_failed", message: err instanceof Error ? err.message : "unknown" }));
    return apiError(500, "INTERNAL_ERROR", "Something went wrong recording the decision.");
  }
}
