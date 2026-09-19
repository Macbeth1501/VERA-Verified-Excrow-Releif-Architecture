import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { findUserById, type PublicUser } from "../auth/users";
import type { CampaignWithMilestones } from "../campaigns/service";
import { createDb, type Db } from "../db";
import { milestoneActions, milestones, users } from "../db/schema";
import { VAULT, makeDonor, makeLiveCampaign } from "../donations/test-setup";
import { submitAttestation } from "./attestationCollector";
import { councilApprove, releaseMilestone } from "./councilWorkflow";
import { FakeEscrowChain } from "./fake-chain";
import { defineMilestonesOnChain, listRoleGrants, roleIsSynced, setRole, type RoleKind } from "./service";

const PROOF = `0x${"ab".repeat(32)}`;
let db: Db;
let chain: FakeEscrowChain;
let campaign: CampaignWithMilestones;
let milestoneId: string;

beforeEach(async () => {
  db = createDb(":memory:");
  chain = new FakeEscrowChain();
  campaign = await makeLiveCampaign(db);
  milestoneId = campaign.milestones[0].id;
});

/** A new account holding the role, registered on the fake contract. */
async function person(role: RoleKind): Promise<PublicUser> {
  const user = await makeDonor(db);
  const result = await setRole(db, chain, { email: user.email, role, active: true });
  expect(result.ok).toBe(true);
  return findUserById(db, user.id)!;
}

/** Defines the campaign's milestone on the fake contract (needs the organizer's wallet key). */
async function define() {
  const result = await defineMilestonesOnChain(db, chain, campaign.id);
  expect(result.status).toBe("defined");
}

describe("roles (admin)", () => {
  it("makes an attestor, registers them on the contract and records the sync", async () => {
    const user = await makeDonor(db);
    const result = await setRole(db, chain, { email: user.email, role: "attestor", active: true });
    expect(result.ok && result.grant.chainSync).toBe("synced");
    expect(findUserById(db, user.id)?.role).toBe("attestor");
    expect(chain.attestors.has(user.walletAddress.toLowerCase())).toBe(true);
    expect(roleIsSynced(db, user.id, "attestor")).toBe(true);
  });

  it("keeps the decision when the contract call fails, and a repeat retries the sync", async () => {
    const user = await makeDonor(db);
    chain.failNext = "rpc down";
    const first = await setRole(db, chain, { email: user.email, role: "council", active: true });
    expect(first.ok && first.grant.chainSync).toBe("failed");
    expect(roleIsSynced(db, user.id, "council")).toBe(false);
    const second = await setRole(db, chain, { email: user.email, role: "council", active: true });
    expect(second.ok && second.grant.chainSync).toBe("synced");
    expect(listRoleGrants(db)).toHaveLength(1);
  });

  it("records 'not configured' instead of failing when escrow is switched off", async () => {
    chain.isConfigured = false;
    const user = await makeDonor(db);
    const result = await setRole(db, chain, { email: user.email, role: "attestor", active: true });
    expect(result.ok && result.grant.chainSync).toBe("not_configured");
  });

  it("refuses organizers, admins and people who already hold the other role", async () => {
    const org = db.select().from(users).where(eq(users.role, "organizer")).get()!;
    const admin = db.select().from(users).where(eq(users.role, "admin")).get()!;
    for (const u of [org, admin]) {
      const r = await setRole(db, chain, { email: u.email, role: "attestor", active: true });
      expect(r.ok).toBe(false);
    }
    const council = await person("council");
    const both = await setRole(db, chain, { email: council.email, role: "attestor", active: true });
    expect(both.ok).toBe(false);
  });

  it("revokes on the contract first, and keeps the role if that fails", async () => {
    const attestor = await person("attestor");
    chain.failNext = "rpc down";
    const failed = await setRole(db, chain, { email: attestor.email, role: "attestor", active: false });
    expect(failed.ok).toBe(false);
    expect(findUserById(db, attestor.id)?.role).toBe("attestor");
    expect(chain.attestors.has(attestor.walletAddress.toLowerCase())).toBe(true);

    const done = await setRole(db, chain, { email: attestor.email, role: "attestor", active: false });
    expect(done.ok).toBe(true);
    expect(findUserById(db, attestor.id)?.role).toBe("donor");
    expect(chain.attestors.has(attestor.walletAddress.toLowerCase())).toBe(false);
  });

  it("reports an unknown email", async () => {
    const r = await setRole(db, chain, { email: "nobody@example.com", role: "attestor", active: true });
    expect(!r.ok && r.code).toBe("USER_NOT_FOUND");
  });
});

describe("defining milestones on the contract", () => {
  it("defines each milestone in order, signed by the organizer, and marks it defined", async () => {
    await define();
    expect(chain.sent).toEqual([`define:${VAULT}:100`]);
    expect(db.select().from(milestones).get()?.chainStatus).toBe("defined");
  });

  it("is safe to repeat: nothing is sent twice", async () => {
    await define();
    await define();
    expect(chain.sent).toHaveLength(1);
  });

  it("adopts a definition that landed on-chain but was never recorded", async () => {
    chain.milestones.set(VAULT, [{ targetPct: 100, required: 2, attestors: new Set(), approvers: new Set(), status: "Pending" }]);
    await define();
    expect(chain.sent).toHaveLength(0);
    expect(db.select().from(milestones).get()?.chainStatus).toBe("defined");
  });

  it("records a failure with its reason and succeeds on retry", async () => {
    chain.failNext = "rpc down";
    const first = await defineMilestonesOnChain(db, chain, campaign.id);
    expect(first).toEqual({ status: "failed", error: "rpc down" });
    expect(db.select().from(milestones).get()).toMatchObject({ chainStatus: "failed", chainError: "rpc down" });
    await define();
    expect(db.select().from(milestones).get()).toMatchObject({ chainStatus: "defined", chainError: null });
  });

  it("explains that a vault from before the manager existed can never release funds", async () => {
    chain.bound = false;
    const r = await defineMilestonesOnChain(db, chain, campaign.id);
    expect(r.status).toBe("failed");
    expect(r.error).toContain("can never be released");
    expect(chain.sent).toHaveLength(0);
  });

  it("does nothing when the chain cannot be read or escrow is off", async () => {
    chain.unreadable = true;
    expect((await defineMilestonesOnChain(db, chain, campaign.id)).status).toBe("failed");
    chain.unreadable = false;
    chain.isConfigured = false;
    expect((await defineMilestonesOnChain(db, chain, campaign.id)).status).toBe("not_configured");
  });
});

describe("attestation (Step 11, FR-ESC-01)", () => {
  it("2 of 3: one confirmation leaves it Pending, the next verifies it", async () => {
    await define();
    const [a1, a2] = [await person("attestor"), await person("attestor")];

    const first = await submitAttestation(db, chain, a1, milestoneId, PROOF);
    expect(first.ok && first.milestone.state).toMatchObject({ status: "Pending", attestationCount: 1, requiredAttestations: 2 });

    const second = await submitAttestation(db, chain, a2, milestoneId, PROOF);
    expect(second.ok && second.milestone.state).toMatchObject({ status: "Verified", attestationCount: 2 });
  });

  it("counts an attestor once, however often they try", async () => {
    await define();
    const a1 = await person("attestor");
    await submitAttestation(db, chain, a1, milestoneId, PROOF);
    const again = await submitAttestation(db, chain, a1, milestoneId, PROOF);
    expect(!again.ok && again.code).toBe("ALREADY_DONE");
    expect(chain.milestones.get(VAULT)?.[0].attestors.size).toBe(1);
    expect(db.select().from(milestoneActions).all()).toHaveLength(1);
  });

  it("refuses anyone who is not a synced attestor", async () => {
    await define();
    const donor = findUserById(db, (await makeDonor(db)).id)!;
    const r = await submitAttestation(db, chain, donor, milestoneId, PROOF);
    expect(!r.ok && r.status).toBe(403);

    const unsynced = await makeDonor(db);
    chain.failNext = "rpc down";
    await setRole(db, chain, { email: unsynced.email, role: "attestor", active: true });
    const r2 = await submitAttestation(db, chain, findUserById(db, unsynced.id)!, milestoneId, PROOF);
    expect(!r2.ok && r2.code).toBe("ROLE_NOT_SYNCED");
  });

  it("says so when the milestone is not on the contract yet", async () => {
    const a1 = await person("attestor");
    const r = await submitAttestation(db, chain, a1, milestoneId, PROOF);
    expect(!r.ok && r.code).toBe("MILESTONE_NOT_READY");
  });

  it("stops accepting confirmations once the milestone is verified", async () => {
    await define();
    for (let i = 0; i < 2; i++) await submitAttestation(db, chain, await person("attestor"), milestoneId, PROOF);
    const late = await submitAttestation(db, chain, await person("attestor"), milestoneId, PROOF);
    expect(!late.ok && late.code).toBe("MILESTONE_NOT_READY");
  });

  it("records a contract refusal as FAILED and lets the attestor retry", async () => {
    await define();
    const a1 = await person("attestor");
    chain.failNext = "rpc down";
    const r = await submitAttestation(db, chain, a1, milestoneId, PROOF);
    expect(!r.ok && r.code).toBe("CHAIN_FAILED");
    expect(db.select().from(milestoneActions).get()?.status).toBe("FAILED");
    const retry = await submitAttestation(db, chain, a1, milestoneId, PROOF);
    expect(retry.ok && retry.action.status).toBe("CONFIRMED");
    expect(db.select().from(milestoneActions).all()).toHaveLength(1);
  });

  it("keeps a sent-but-unconfirmed attestation PENDING with its hash saved, never FAILED", async () => {
    await define();
    const a1 = await person("attestor");
    chain.hangNext = true;
    const r = await submitAttestation(db, chain, a1, milestoneId, PROOF);
    expect(!r.ok && r.code).toBe("ACTION_PENDING");
    const row = db.select().from(milestoneActions).get()!;
    expect(row.status).toBe("PENDING");
    expect(row.txHash).toMatch(/^0x/);

    // still unconfirmed: a second click must not send it again
    const sentBefore = chain.sent.length;
    const again = await submitAttestation(db, chain, a1, milestoneId, PROOF);
    expect(!again.ok && again.code).toBe("ACTION_PENDING");
    expect(chain.sent).toHaveLength(sentBefore);

    // once the chain confirms, the next look settles it
    chain.txStates.set(row.txHash!, "success");
    const settled = await submitAttestation(db, chain, a1, milestoneId, PROOF);
    expect(!settled.ok && settled.code).toBe("ALREADY_DONE");
    expect(db.select().from(milestoneActions).get()?.status).toBe("CONFIRMED");
  });

  it("does not reach the chain at all when escrow is switched off", async () => {
    await define();
    const a1 = await person("attestor");
    chain.isConfigured = false;
    const r = await submitAttestation(db, chain, a1, milestoneId, PROOF);
    expect(!r.ok && r.code).toBe("ESCROW_NOT_CONFIGURED");
  });
});

/** Two attestors verify the milestone. */
async function verify() {
  await define();
  for (let i = 0; i < 2; i++) await submitAttestation(db, chain, await person("attestor"), milestoneId, PROOF);
}

describe("release (Step 12, FR-GOV-01)", () => {
  const organizer = () => findUserById(db, db.select().from(users).where(eq(users.role, "organizer")).get()!.id)!;

  it("pays out a verified milestone below the limit with no council", async () => {
    await verify();
    const r = await releaseMilestone(db, chain, organizer(), milestoneId);
    expect(r.ok && r.milestone.state?.status).toBe("Released");
    expect(db.select().from(milestones).get()?.status).toBe("RELEASED");
  });

  it("refuses to release a milestone that is not verified yet", async () => {
    await define();
    const r = await releaseMilestone(db, chain, organizer(), milestoneId);
    expect(!r.ok && r.code).toBe("MILESTONE_NOT_READY");
  });

  it("above the limit, 2 approvals do not release and the 3rd does", async () => {
    chain.payout = 400_000_000n; // above the 100 mINR limit
    await verify();
    const members = [await person("council"), await person("council"), await person("council")];

    for (const m of members.slice(0, 2)) expect((await councilApprove(db, chain, m, milestoneId)).ok).toBe(true);
    const early = await releaseMilestone(db, chain, organizer(), milestoneId);
    expect(!early.ok && early.message).toContain("needs 3 council approvals; it has 2");
    expect(chain.milestones.get(VAULT)?.[0].status).toBe("Verified");

    const third = await councilApprove(db, chain, members[2], milestoneId);
    expect(third.ok && third.milestone.state?.councilApprovals).toBe(3);
    const done = await releaseMilestone(db, chain, organizer(), milestoneId);
    expect(done.ok && done.milestone.state?.status).toBe("Released");
  });

  it("counts a council member once", async () => {
    await verify();
    const m = await person("council");
    await councilApprove(db, chain, m, milestoneId);
    const again = await councilApprove(db, chain, m, milestoneId);
    expect(!again.ok && again.code).toBe("ALREADY_DONE");
    expect(chain.milestones.get(VAULT)?.[0].approvers.size).toBe(1);
  });

  it("only lets a council member approve, and only once verified", async () => {
    await define();
    const attestor = await person("attestor");
    const wrong = await councilApprove(db, chain, attestor, milestoneId);
    expect(!wrong.ok && wrong.status).toBe(403);
    const member = await person("council");
    const early = await councilApprove(db, chain, member, milestoneId);
    expect(!early.ok && early.code).toBe("MILESTONE_NOT_READY");
  });

  it("limits who may trigger a release to the organizer, council or an admin", async () => {
    await verify();
    const stranger = findUserById(db, (await makeDonor(db)).id)!;
    const r = await releaseMilestone(db, chain, stranger, milestoneId);
    expect(!r.ok && r.status).toBe(403);
    const attestor = await person("attestor");
    expect((await releaseMilestone(db, chain, attestor, milestoneId)).ok).toBe(false);
  });

  it("cannot release twice", async () => {
    await verify();
    await releaseMilestone(db, chain, organizer(), milestoneId);
    const again = await releaseMilestone(db, chain, organizer(), milestoneId);
    expect(!again.ok && again.code).toBe("ALREADY_DONE");
    expect(chain.sent.filter((s) => s.startsWith("release"))).toHaveLength(1);
  });

  it("leaves the milestone Verified and retryable when the release transaction fails", async () => {
    await verify();
    chain.failNext = "rpc down";
    const r = await releaseMilestone(db, chain, organizer(), milestoneId);
    expect(!r.ok && r.code).toBe("CHAIN_FAILED");
    expect(db.select().from(milestones).get()?.status).not.toBe("RELEASED");
    const retry = await releaseMilestone(db, chain, organizer(), milestoneId);
    expect(retry.ok).toBe(true);
  });
});
