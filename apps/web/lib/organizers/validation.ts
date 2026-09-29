import { z } from "zod";
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES } from "../files/service";

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(2, `${label} is required`)
    .max(max, `${label} is too long`);

/**
 * Mock-KYB application (FR-IDN-02). The supporting document is hashed in the browser so the hash
 * always accompanies the application; `documentData`/`documentMimeType` are the base64-encoded
 * bytes of that same file, sent alongside so an admin can actually open it to verify (optional,
 * for backward compatibility with older clients that only ever sent the hash).
 */
export const applicationSchema = z.object({
  legalName: text("Legal name", 200),
  registrationNumber: text("Registration number", 64),
  jurisdiction: text("Jurisdiction", 100),
  documentHash: z.string().regex(/^[0-9a-fA-F]{64}$/, "Attach a supporting document"),
  documentName: text("Document name", 200),
  documentMimeType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES).optional(),
  // base64 grows content by ~4/3; cap the encoded string generously above the decoded byte limit.
  documentData: z
    .string()
    .max(Math.ceil((MAX_DOCUMENT_BYTES * 4) / 3) + 1024)
    .optional(),
});

export const decisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.decision !== "reject" || (v.reason && v.reason.length >= 3), {
    message: "Give a short reason when rejecting an application",
    path: ["reason"],
  });

export type ApplicationInput = z.infer<typeof applicationSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
