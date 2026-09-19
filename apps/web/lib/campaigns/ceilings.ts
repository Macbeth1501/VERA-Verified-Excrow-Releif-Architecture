/**
 * Publicly disclosed, contract-enforced admin-expense ceilings per category, in whole percent.
 *
 * These MUST match `CampaignFactory.categoryAdminCeilingPct` on the deployed contract, which is
 * the authoritative check (SPDD §19.2, §20.3). The values here exist so the UI and API can give
 * fast feedback; they can never permit something the contract would refuse, because the contract
 * re-checks. `assertCeilingsMatchChain` in the campaign chain module verifies them at deploy time.
 */
export const CATEGORY_ADMIN_CEILING_PCT = {
  DISASTER_RELIEF: 10,
  MEDICAL: 15,
  COMMUNITY: 20,
} as const;

export type CampaignCategory = keyof typeof CATEGORY_ADMIN_CEILING_PCT;

export const CAMPAIGN_CATEGORIES = Object.keys(CATEGORY_ADMIN_CEILING_PCT) as CampaignCategory[];

/** Enum ordinal expected by the Solidity `CampaignCategory` enum. Order must not change. */
export const CATEGORY_ENUM_INDEX: Record<CampaignCategory, number> = {
  DISASTER_RELIEF: 0,
  MEDICAL: 1,
  COMMUNITY: 2,
};

export const CATEGORY_LABEL: Record<CampaignCategory, string> = {
  DISASTER_RELIEF: "Disaster relief",
  MEDICAL: "Medical",
  COMMUNITY: "Community",
};

export function ceilingFor(category: CampaignCategory): number {
  return CATEGORY_ADMIN_CEILING_PCT[category];
}
