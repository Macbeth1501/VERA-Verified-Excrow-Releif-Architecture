import { apiError } from "@/lib/api/errors";
import { getDb } from "@/lib/db";
import { getPublicProfile } from "@/lib/organizers/service";

/** GET /api/v1/organizers/:id: public profile. Only verified organizers are visible (FR-IDN-02). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = getPublicProfile(getDb(), id);
  if (!profile) return apiError(404, "ORGANIZER_NOT_FOUND", "No verified organizer found with this ID.");
  return Response.json({ profile });
}
