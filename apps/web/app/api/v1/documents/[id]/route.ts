import { apiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { getDb } from "@/lib/db";
import { getDocument } from "@/lib/files/service";

/**
 * GET /api/v1/documents/:id: opens a previously uploaded KYB document or milestone evidence file
 * for the role that is actually supposed to review it. Never listed publicly; the id alone is not
 * enough, the viewer's role (read from the database) also has to match the document's purpose.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  const doc = getDocument(getDb(), id);
  if (!doc) return apiError(404, "DOCUMENT_NOT_FOUND", "Document not found");

  const allowedRoles =
    doc.purpose === "kyb" ? (["admin"] as const) : (["admin", "attestor", "council"] as const);
  if (!(allowedRoles as readonly string[]).includes(auth.user.role)) {
    return apiError(403, "FORBIDDEN", "You do not have permission to view this document.");
  }

  return new Response(new Uint8Array(doc.data), {
    headers: {
      "content-type": doc.mimeType,
      // inline is safe here: mimeType is restricted to a small image/PDF allowlist (lib/files/service.ts), never a script-executable type
      "content-disposition": `inline; filename="${doc.filename.replace(/[^\w.\-]/g, "_")}"`,
      "cache-control": "private, no-store",
    },
  });
}
