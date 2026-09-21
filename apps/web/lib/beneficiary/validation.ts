import { z } from "zod";

const bytes32 = (what: string) =>
  z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, `${what} must be a 0x-prefixed 64-character hash made in the browser`)
    .transform((v) => v.toLowerCase());

/**
 * What the API accepts to register a beneficiary. Only fingerprints ever arrive: `identityHash` is
 * the salted hash from `hashIdentityFragment`, `photoHash` an optional hash of a photo. There is
 * deliberately no field for a name, ID number or any raw identity data.
 */
export const registerBeneficiarySchema = z.object({
  identityHash: bytes32("The identity fingerprint").refine((v) => !/^0x0{64}$/.test(v), "The identity fingerprint cannot be empty"),
  photoHash: bytes32("The photo fingerprint").optional(),
  payoutMethod: z.string().trim().min(1, "Choose how this person will be paid").max(60, "Keep the payout method under 60 characters"),
});

export type RegisterBeneficiaryInput = z.infer<typeof registerBeneficiarySchema>;
