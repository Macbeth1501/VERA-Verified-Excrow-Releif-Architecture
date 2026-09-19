import { eq } from "drizzle-orm";
import { registerDonor } from "../auth/users";
import { createCampaign, recordVaultDeploy } from "../campaigns/service";
import type { Db } from "../db";
import { users } from "../db/schema";
import { decide, submitApplication } from "../organizers/service";

export const VAULT = "0x6590E3D9E42EDB7e8970b9348CE457b9a2f990F7";
const ENC_KEY = "ab".repeat(32);
let counter = 0;

export async function makeDonor(db: Db, walletAddress?: `0x${string}`) {
  return registerDonor(
    db,
    { email: `donor${++counter}@example.com`, password: "correct-horse-battery", walletAddress },
    ENC_KEY,
  );
}

/** A LIVE campaign whose vault is VAULT, as if publishing had succeeded. */
export async function makeLiveCampaign(db: Db) {
  const org = await makeDonor(db);
  const admin = await makeDonor(db);
  db.update(users).set({ role: "admin" }).where(eq(users.id, admin.id)).run();
  const profile = submitApplication(db, org.id, {
    legalName: "Trust", registrationNumber: "R-1", jurisdiction: "India", documentHash: "a".repeat(64), documentName: "d.pdf",
  });
  decide(db, profile.id, admin.id, "approve");
  const campaign = createCampaign(db, profile.id, {
    title: "Flood relief for Assam",
    summary: "Emergency food, clean water and shelter for families displaced by floods.",
    category: "DISASTER_RELIEF",
    fundingGoalMinorUnits: "1000000000",
    adminExpenseCapPct: 10,
    milestones: [{ description: "Deliver food and water", targetPct: 100, requiredAttestations: 2 }],
  });
  return recordVaultDeploy(db, campaign.id, { status: "deployed", vaultAddress: VAULT, onchainCampaignId: 0, txHash: "0x1" });
}
