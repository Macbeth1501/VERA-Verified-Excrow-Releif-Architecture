import { z } from "zod";
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES } from "../files/service";

/**
 * SHA-256 (or any 32-byte) hash of the evidence, computed in the browser: 0x plus 64 hex
 * characters. `evidenceData`/`evidenceMimeType` are the same file's base64 bytes, sent alongside
 * so an admin/attestor/council viewer can actually open what was attested to (optional, for
 * backward compatibility with older clients that only ever sent the hash).
 */
export const attestationSchema = z.object({
  proofHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Attach the evidence so its hash can be computed."),
  evidenceMimeType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES).optional(),
  evidenceData: z
    .string()
    .max(Math.ceil((MAX_DOCUMENT_BYTES * 4) / 3) + 1024)
    .optional(),
  evidenceName: z.string().trim().max(200).optional(),
});

export const roleSchema = z.object({
  email: z.string().trim().min(3).max(254),
  role: z.enum(["attestor", "council"]),
  active: z.boolean(),
});
