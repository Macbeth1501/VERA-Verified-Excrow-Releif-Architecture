import { apiError } from "@/lib/api/errors";
import { readJson, requireUser } from "@/lib/api/guards";
import { allow } from "@/lib/api/rate-limit";
import { getDb } from "@/lib/db";
import { AlreadyAppliedError, submitApplication } from "@/lib/organizers/service";
import { applicationSchema } from "@/lib/organizers/validation";

/** POST /api/v1/organizers/verify: submit a mock-KYB application (FR-IDN-02). Status starts pending. */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  // Admins approve and flag only; they do not run campaigns (SPDD 13.3).
  if (user.role === "admin") return apiError(403, "FORBIDDEN", "Admin accounts cannot apply as organizers.");
  if (!allow(`kyb:${user.id}`, { capacity: 5, refillPerSecond: 5 / 300 })) {
    return apiError(429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.");
  }

  const json = await readJson(request);
  if (json.response) return json.response;
  const parsed = applicationSchema.safeParse(json.body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_FAILED", "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const profile = submitApplication(getDb(), user.id, parsed.data);
    return Response.json({ kyb_status: profile.kybStatus, profile }, { status: 201 });
  } catch (err) {
    if (err instanceof AlreadyAppliedError) {
      return apiError(409, "ALREADY_APPLIED", err.message, { kyb_status: err.status });
    }
    console.error(JSON.stringify({ event: "kyb_submit_failed", message: err instanceof Error ? err.message : "unknown" }));
    return apiError(500, "INTERNAL_ERROR", "Something went wrong submitting your application.");
  }
}
