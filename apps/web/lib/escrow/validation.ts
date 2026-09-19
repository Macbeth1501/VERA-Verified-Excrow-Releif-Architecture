import { z } from "zod";

/** SHA-256 (or any 32-byte) hash of the evidence, computed in the browser: 0x plus 64 hex characters. */
export const attestationSchema = z.object({
  proofHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Attach the evidence so its hash can be computed."),
});

export const roleSchema = z.object({
  email: z.string().trim().min(3).max(254),
  role: z.enum(["attestor", "council"]),
  active: z.boolean(),
});
