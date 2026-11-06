import { z } from "zod";
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES } from "../files/service";
import { MAX_RELEASE_LIMIT_RUPEES, releaseLimitToMinorUnits } from "./release-limit";

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

/** Admin request to change the global council-approval limit; the output carries minor units. */
export const releaseLimitSchema = z.object({
  limitRupees: z
    .string()
    .transform((v, ctx) => {
      const minor = releaseLimitToMinorUnits(v);
      if (minor === null) {
        ctx.addIssue({ code: "custom", message: `Enter rupees from 0 to ${MAX_RELEASE_LIMIT_RUPEES.toLocaleString("en-IN")}, with at most 2 decimals.` });
        return z.NEVER;
      }
      return minor;
    }),
});

/** Admin request to change the global council threshold K (whole number, at least the contract floor of 2). */
export const thresholdSchema = z.object({
  threshold: z.number().int("Enter a whole number.").min(2, "The council needs at least 2 approvals.").max(100),
});

/** Admin request to grant or revoke the attestor or council role for a user, by email. */
export const roleSchema = z.object({
  email: z.string().trim().min(3).max(254),
  role: z.enum(["attestor", "council"]),
  active: z.boolean(),
});
