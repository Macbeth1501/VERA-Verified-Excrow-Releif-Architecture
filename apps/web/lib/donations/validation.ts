import { z } from "zod";

/** mINR has 6 decimals. Amounts are integer minor units in strings (SPDD 12.1). */
export const MIN_DONATION_MINOR_UNITS = 1_000_000n; // 1 rupee
/** A sanity cap: the on-ramp is a free faucet, so nothing stops absurd amounts otherwise. */
export const MAX_DONATION_MINOR_UNITS = 1_000_000_000_000n; // 10,00,000 rupees

export const createDonationSchema = z
  .object({
    campaignId: z.string().min(1),
    amountMinorUnits: z.string().regex(/^[1-9][0-9]{0,17}$/, "Enter a donation amount"),
    /**
     * Only meaningful when the platform charges a fee. There is deliberately no default: the donor
     * must choose, so a fee can never be pre-selected on their behalf (FR-CMP-02).
     */
    feeChoice: z.enum(["cover", "decline"]).optional(),
  })
  .superRefine((value, ctx) => {
    // The format check above may already have failed; BigInt() would throw on such input.
    if (!/^[1-9][0-9]{0,17}$/.test(value.amountMinorUnits)) return;
    const amount = BigInt(value.amountMinorUnits);
    if (amount < MIN_DONATION_MINOR_UNITS) {
      ctx.addIssue({ code: "custom", path: ["amountMinorUnits"], message: "The smallest donation is 1 rupee" });
    }
    if (amount > MAX_DONATION_MINOR_UNITS) {
      ctx.addIssue({ code: "custom", path: ["amountMinorUnits"], message: "The largest donation is 10,00,000 rupees" });
    }
  });

export type CreateDonationInput = z.infer<typeof createDonationSchema>;
