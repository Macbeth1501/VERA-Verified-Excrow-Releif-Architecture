import { describe, expect, it } from "vitest";
import { createCampaignSchema, sumPct } from "./validation";
import { CATEGORY_ADMIN_CEILING_PCT } from "./ceilings";

const valid = {
  title: "Flood relief for Assam",
  summary: "Emergency food, clean water and shelter for families displaced by the 2026 floods.",
  category: "DISASTER_RELIEF" as const,
  fundingGoalMinorUnits: "1000000000",
  adminExpenseCapPct: 10,
  milestones: [
    { description: "Deliver food and water to 500 families", targetPct: 60, requiredAttestations: 2 },
    { description: "Rebuild 20 damaged homes", targetPct: 40, requiredAttestations: 3 },
  ],
};

function errorsFor(input: unknown): Record<string, string[] | undefined> {
  const parsed = createCampaignSchema.safeParse(input);
  return parsed.success ? {} : parsed.error.flatten().fieldErrors;
}

describe("createCampaignSchema", () => {
  it("accepts a well-formed campaign", () => {
    expect(createCampaignSchema.safeParse(valid).success).toBe(true);
  });

  // FR-CMP-01 acceptance criterion: 90% and 110% must be refused.
  it("rejects milestones totalling 90% or 110%, and says the actual total", () => {
    const under = errorsFor({ ...valid, milestones: [{ ...valid.milestones[0], targetPct: 50 }, valid.milestones[1]] });
    expect(under.milestones?.[0]).toContain("total 90%");

    const over = errorsFor({ ...valid, milestones: [{ ...valid.milestones[0], targetPct: 70 }, valid.milestones[1]] });
    expect(over.milestones?.[0]).toContain("total 110%");
  });

  it("accepts any split that totals exactly 100", () => {
    const thirds = [
      { description: "Phase one of the relief effort", targetPct: 34, requiredAttestations: 2 },
      { description: "Phase two of the relief effort", targetPct: 33, requiredAttestations: 2 },
      { description: "Phase three of the relief effort", targetPct: 33, requiredAttestations: 2 },
    ];
    expect(createCampaignSchema.safeParse({ ...valid, milestones: thirds }).success).toBe(true);
  });

  it("requires at least one milestone", () => {
    expect(errorsFor({ ...valid, milestones: [] }).milestones).toBeDefined();
  });

  it("enforces each category ceiling and allows exactly the ceiling", () => {
    for (const [category, ceiling] of Object.entries(CATEGORY_ADMIN_CEILING_PCT)) {
      expect(createCampaignSchema.safeParse({ ...valid, category, adminExpenseCapPct: ceiling }).success).toBe(true);
      const over = errorsFor({ ...valid, category, adminExpenseCapPct: ceiling + 1 });
      expect(over.adminExpenseCapPct?.[0]).toContain(`cannot exceed ${ceiling}%`);
    }
  });

  it("reports both cross-field problems at once", () => {
    const errors = errorsFor({ ...valid, adminExpenseCapPct: 99, milestones: [{ ...valid.milestones[0], targetPct: 10 }] });
    expect(errors.milestones).toBeDefined();
    expect(errors.adminExpenseCapPct).toBeDefined();
  });

  it("rejects a zero, negative or non-integer funding goal", () => {
    for (const goal of ["0", "-5", "1.5", "", "abc"]) {
      expect(errorsFor({ ...valid, fundingGoalMinorUnits: goal }).fundingGoalMinorUnits).toBeDefined();
    }
  });

  it("requires a real title, summary and milestone description", () => {
    expect(errorsFor({ ...valid, title: "Hi" }).title).toBeDefined();
    expect(errorsFor({ ...valid, summary: "Too short" }).summary).toBeDefined();
    expect(errorsFor({ ...valid, milestones: [{ ...valid.milestones[0], description: "x", targetPct: 100 }] }).milestones).toBeDefined();
  });

  it("requires at least one attestation per milestone", () => {
    const bad = [{ description: "Single milestone covering everything", targetPct: 100, requiredAttestations: 0 }];
    expect(errorsFor({ ...valid, milestones: bad }).milestones).toBeDefined();
  });

  it("rejects an unknown category", () => {
    expect(errorsFor({ ...valid, category: "CRYPTO_MOONSHOT" }).category).toBeDefined();
  });
});

describe("sumPct", () => {
  it("adds percentages and ignores non-numeric entries", () => {
    expect(sumPct([{ targetPct: 60 }, { targetPct: 40 }])).toBe(100);
    expect(sumPct([])).toBe(0);
    expect(sumPct([{ targetPct: Number.NaN }, { targetPct: 25 }])).toBe(25);
  });
});

describe("confirmations per milestone", () => {
  it("requires at least 2, matching the MilestoneManager contract (no single attestor can verify)", () => {
    const one = [{ description: "Deliver food and water", targetPct: 100, requiredAttestations: 1 }];
    expect(createCampaignSchema.safeParse({ ...valid, milestones: one }).success).toBe(false);
  });
});
