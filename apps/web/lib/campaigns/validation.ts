import { z } from "zod";
import { CAMPAIGN_CATEGORIES, CATEGORY_LABEL, ceilingFor, type CampaignCategory } from "./ceilings";

/** Milestone percentages must total exactly this (FR-CMP-01). */
export const REQUIRED_MILESTONE_TOTAL = 100;
export const MAX_MILESTONES = 10;

const milestoneSchema = z.object({
  description: z.string().trim().min(3, "Describe what this milestone delivers").max(300),
  targetPct: z
    .number()
    .int("Use whole percentages")
    .min(1, "Each milestone must be at least 1%")
    .max(100),
  requiredAttestations: z
    .number()
    .int()
    .min(2, "At least two independent confirmations are required, so no single person can release funds")
    .max(10, "At most 10 confirmations"),
});

const baseSchema = z.object({
  title: z.string().trim().min(5, "Give the campaign a clear title").max(160),
  summary: z.string().trim().min(20, "Describe the campaign in at least 20 characters").max(2000),
  category: z.enum(CAMPAIGN_CATEGORIES as [CampaignCategory, ...CampaignCategory[]]),
  /** Integer mINR minor units (6 decimals) as a string, per SPDD §12.1. */
  fundingGoalMinorUnits: z
    .string()
    .regex(/^[1-9][0-9]{0,17}$/, "Enter a funding goal greater than zero"),
  adminExpenseCapPct: z.number().int("Use a whole percentage").min(0).max(100),
  milestones: z
    .array(milestoneSchema)
    .min(1, "Add at least one milestone")
    .max(MAX_MILESTONES, `At most ${MAX_MILESTONES} milestones`),
});

/**
 * Full campaign validation. The two cross-field rules are the ones the contract also enforces:
 * milestone percentages must sum to exactly 100, and the admin cap must not exceed the category
 * ceiling. Both are reported against the field the user can fix.
 */
export const createCampaignSchema = baseSchema.superRefine((value, ctx) => {
  const total = sumPct(value.milestones);
  if (total !== REQUIRED_MILESTONE_TOTAL) {
    ctx.addIssue({
      code: "custom",
      path: ["milestones"],
      message: `Milestone percentages must add up to exactly 100%. They currently total ${total}%.`,
    });
  }

  const ceiling = ceilingFor(value.category);
  if (value.adminExpenseCapPct > ceiling) {
    ctx.addIssue({
      code: "custom",
      path: ["adminExpenseCapPct"],
      message: `The admin cost cap for ${CATEGORY_LABEL[value.category].toLowerCase()} campaigns cannot exceed ${ceiling}%.`,
    });
  }
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export function sumPct(milestones: Array<{ targetPct: number }>): number {
  return milestones.reduce((total, m) => total + (Number.isFinite(m.targetPct) ? m.targetPct : 0), 0);
}
