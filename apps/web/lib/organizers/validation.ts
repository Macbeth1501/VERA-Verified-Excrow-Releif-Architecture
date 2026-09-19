import { z } from "zod";

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(2, `${label} is required`)
    .max(max, `${label} is too long`);

/**
 * Mock-KYB application (FR-IDN-02). The supporting document is hashed in the browser; the server
 * only ever receives the SHA-256 hex digest and the file name.
 */
export const applicationSchema = z.object({
  legalName: text("Legal name", 200),
  registrationNumber: text("Registration number", 64),
  jurisdiction: text("Jurisdiction", 100),
  documentHash: z.string().regex(/^[0-9a-fA-F]{64}$/, "Attach a supporting document"),
  documentName: text("Document name", 200),
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
