import { z } from "zod";

/**
 * What the API accepts to record a milestone payout: which registered beneficiary is paid and how
 * much, in mINR minor units. The payout reference is generated server-side by the simulated off-ramp,
 * never taken from the caller, and the amount is capped by the contract at what the campaign released.
 */
export const disburseSchema = z.object({
  beneficiaryId: z.string().trim().min(1, "Choose a registered beneficiary").max(64),
  amountMinorUnits: z.string().regex(/^[1-9][0-9]{0,17}$/, "Enter a payout amount"),
});

export type DisburseInput = z.infer<typeof disburseSchema>;
