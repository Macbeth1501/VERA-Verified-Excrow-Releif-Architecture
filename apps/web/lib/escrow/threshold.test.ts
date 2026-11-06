/** C4: the admin-set council threshold K: floor, ceiling (council size), the in-flight list, and a release that flips when K is lowered. */

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { findUserById, type PublicUser } from "../auth/users";
import type { CampaignWithMilestones } from "../campaigns/service";
import { createDb, type Db } from "../db";
import { users } from "../db/schema";
import { makeDonor, makeLiveCampaign } from "../donations/test-setup";
import { submitAttestation } from "./attestationCollector";
import { councilApprove, releaseMilestone } from "./councilWorkflow";
import { FakeEscrowChain } from "./fake-chain";
import { defineMilestonesOnChain, setRole, type RoleKind } from "./service";
import { getThreshold, setThreshold } from "./threshold";
import { describeEffect, thresholdEffect, thresholdRefusal } from "./threshold-effect";

const PROOF = `0x${"ab".repeat(32)}`;
let db: Db;
let chain: FakeEscrowChain;
let campaign: CampaignWithMilestones;
let milestoneId: string;

beforeEach(() => {
  db = createDb(":memory:");
  chain = new FakeEscrowChain();
});

async function person(role: RoleKind): Promise<PublicUser> {
  const user = await makeDonor(db);
  expect((await setRole(db, chain, { email: user.email, role, active: true })).ok).toBe(true);
  return findUserById(db, user.id)!;
}
const members = async (n: number) => {
  const out: PublicUser[] = [];
  for (let i = 0; i < n; i++) out.push(await person("council"));
  return out;
};
async function verifiedAboveLimit() {
  campaign = await makeLiveCampaign(db);
  milestoneId = campaign.milestones[0].id;
  chain.payout = 400_000_000n; // above the 100 mINR limit
  expect((await defineMilestonesOnChain(db, chain, campaign.id)).status).toBe("defined");
  for (let i = 0; i < 2; i++) await submitAttestation(db, chain, await person("attestor"), milestoneId, PROOF);
}
const organizer = () => findUserById(db, db.select().from(users).where(eq(users.role, "organizer")).get()!.id)!;

describe("pure helpers", () => {
  it("effect: releasable at or above K, otherwise how many more", () => {
    expect(thresholdEffect(2, 2)).toEqual({ kind: "releasable" });
    expect(thresholdEffect(3, 2)).toEqual({ kind: "releasable" });
    expect(thresholdEffect(1, 4)).toEqual({ kind: "needs_more", more: 3 });
    expect(describeEffect(2, 3)).toBe("now needs 1 more approval");
    expect(describeEffect(0, 3)).toBe("now needs 3 more approvals");
    expect(describeEffect(3, 3)).toBe("now releasable");
  });

  it("refusal: floor, ceiling by council size, and fewer than two members", () => {
    expect(thresholdRefusal(1, 5)).toMatch(/at least 2/);
    expect(thresholdRefusal(0, 5)).toMatch(/at least 2/);
    expect(thresholdRefusal(2.5, 5)).toMatch(/at least 2/);
    expect(thresholdRefusal(4, 3)).toMatch(/Only 3 council members are registered/);
    expect(thresholdRefusal(2, 1)).toMatch(/Only 1 council member is registered/);
    expect(thresholdRefusal(3, 3)).toBeNull();
    expect(thresholdRefusal(2, 5)).toBeNull();
  });
});

describe("setThreshold", () => {
  it("sets K within [2, council size] and reads it back", async () => {
    await members(4);
    const r = await setThreshold(db, chain, 4);
    expect(r.ok && r.txHash).toMatch(/^0x/);
    expect(await chain.readCouncilThreshold()).toBe(4);
    expect((await setThreshold(db, chain, 2)).ok).toBe(true);
    expect(chain.councilThreshold).toBe(2);
  });

  it("refuses K below 2 and sends nothing", async () => {
    await members(3);
    const r = await setThreshold(db, chain, 1);
    expect(!r.ok && r.status).toBe(422);
    expect(chain.councilThreshold).toBe(3);
    expect(chain.sent).not.toContain("threshold:1");
  });

  it("refuses K above the number of synced council members, and ignores unsynced ones", async () => {
    await members(3);
    const failing = await makeDonor(db);
    chain.failNext = "rpc down";
    await setRole(db, chain, { email: failing.email, role: "council", active: true }); // saved, not synced
    const r = await setThreshold(db, chain, 4);
    expect(!r.ok && r.message).toMatch(/Only 3 council members are registered/);
    expect(chain.councilThreshold).toBe(3);
  });

  it("refuses when escrow is off, reports a chain failure, and a hung send is pending", async () => {
    await members(3);
    chain.isConfigured = false;
    expect((await setThreshold(db, chain, 2)), "off").toMatchObject({ ok: false, code: "ESCROW_NOT_CONFIGURED" });
    chain.isConfigured = true;
    chain.failNext = "rpc down";
    expect(await setThreshold(db, chain, 2)).toMatchObject({ ok: false, code: "CHAIN_FAILED" });
    chain.hangNext = true;
    expect(await setThreshold(db, chain, 2)).toMatchObject({ ok: true, pending: true });
  });
});

describe("getThreshold", () => {
  it("reports K, the council size, and unreadable / not configured", async () => {
    await members(3);
    expect(await getThreshold(db, chain)).toMatchObject({ configured: true, threshold: 3, councilMembers: 3, inFlight: [] });
    chain.unreadable = true;
    expect((await getThreshold(db, chain)).threshold).toBeNull();
    chain.unreadable = false;
    chain.isConfigured = false;
    expect(await getThreshold(db, chain)).toMatchObject({ configured: false, threshold: null });
  });

  it("lists verified milestones above their limit with their approvals, and not small or unverified ones", async () => {
    const [a] = await members(3);
    await verifiedAboveLimit();
    await councilApprove(db, chain, a, milestoneId);
    const view = await getThreshold(db, chain);
    expect(view.inFlight).toHaveLength(1);
    expect(view.inFlight[0]).toMatchObject({ milestoneId, councilApprovals: 1, index: 0 });

    chain.payout = 40_000_000n; // now under the limit: no council needed, so not "waiting"
    expect((await getThreshold(db, chain)).inFlight).toEqual([]);
  });
});

describe("K is not snapshotted: lowering it frees a release that was refused", () => {
  it("2 approvals are refused at K=3, then the release works after K is lowered to 2", async () => {
    const [a, b] = await members(3);
    await verifiedAboveLimit();
    await councilApprove(db, chain, a, milestoneId);
    await councilApprove(db, chain, b, milestoneId);

    const refused = await releaseMilestone(db, chain, organizer(), milestoneId);
    expect(refused.ok).toBe(false);
    expect((await getThreshold(db, chain)).inFlight[0].councilApprovals).toBe(2);
    expect(describeEffect(2, 2)).toBe("now releasable");

    expect((await setThreshold(db, chain, 2)).ok).toBe(true);
    const allowed = await releaseMilestone(db, chain, organizer(), milestoneId);
    expect(allowed.ok && allowed.milestone.state?.status).toBe("Released");
  });

  it("raising K makes an approved milestone need more", async () => {
    const [a, b] = await members(4);
    await setThreshold(db, chain, 2);
    await verifiedAboveLimit();
    await councilApprove(db, chain, a, milestoneId);
    await councilApprove(db, chain, b, milestoneId);
    await setThreshold(db, chain, 4);
    expect((await releaseMilestone(db, chain, organizer(), milestoneId)).ok).toBe(false);
  });
});
