/**
 * OPT-IN end-to-end run against a LOCAL anvil chain (0 POL): campaign expiry and refunds through the
 * real route handlers, the real viem chain modules (campaign publishing with a deadline, the vault's
 * close and refund calls) and the real indexer reader. Anvil's clock is moved forward with
 * `evm_increaseTime` to make the campaign stall, so no waiting is needed. Contracts must be deployed
 * as in docs/manual_test_local.md (from the CURRENT build: the vault and Factory gained the expiry
 * functions), then:
 *
 *   LIVE_LOCAL=1 RPC_URL=http://127.0.0.1:8545 MOCK_INR_ADDRESS=... FACTORY_ADDRESS=... \
 *   MILESTONE_MANAGER_ADDRESS=... FACTORY_OWNER_KEY=<anvil account 0> \
 *   npx vitest run lib/expiry/live-local.test.ts
 *
 * It refuses to run against anything but localhost, so it can never spend testnet POL.
 */
import { eq } from "drizzle-orm";
import { createPublicClient, erc20Abi, http } from "viem";
import { polygonAmoy } from "viem/chains";
import { describe, expect, it } from "vitest";

const live = process.env.LIVE_LOCAL === "1";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(process.env.RPC_URL ?? "");

describe.skipIf(!live)("local anvil: a stalled campaign is closed and its donors are refunded", () => {
  it(
    "refuses an early close, closes after the inactivity window, refunds pro rata once, and the ledger reconciles",
    async () => {
      if (!isLocal) throw new Error("LIVE_LOCAL only runs against a local RPC (RPC_URL must be 127.0.0.1 or localhost).");
      Object.assign(process.env, {
        DATABASE_URL: ":memory:",
        AUTH_SECRET: "s".repeat(40),
        WALLET_ENCRYPTION_KEY: "ab".repeat(32),
        INDEXER_START_BLOCK: "0",
        MANAGER_START_BLOCK: "0",
      });
      delete process.env.REGISTRY_START_BLOCK;
      delete process.env.DISBURSEMENT_START_BLOCK;
      const { resetEnvCache, getEnv } = await import("@/lib/env");
      resetEnvCache();
      const { getDb, resetDbForTests } = await import("@/lib/db");
      resetDbForTests();
      const { signSession } = await import("@/lib/auth/session");
      const { registerDonor } = await import("@/lib/auth/users");
      const { users } = await import("@/lib/db/schema");
      const env = getEnv();
      const db = getDb();
      const log = (m: string) => console.log(`[local] ${m}`);

      let n = 0;
      const stamp = Date.now();
      const make = async (label: string) => {
        const u = await registerDonor(db, { email: `${label}-${stamp}-${++n}@example.com`, password: "correct-horse-battery" }, env.WALLET_ENCRYPTION_KEY);
        return { ...u, cookie: `vera_session=${await signSession({ userId: u.id, role: "donor" })}` };
      };
      const call = async (handler: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response>, cookie: string, body?: unknown, id = "x", method = "POST") => {
        const res = await handler(
          new Request("http://localhost/x", {
            method,
            headers: { "content-type": "application/json", cookie },
            body: body === undefined ? undefined : JSON.stringify(body),
          }),
          { params: Promise.resolve({ id }) },
        );
        return { status: res.status, body: await res.json().catch(() => null) };
      };
      const rpc = async (method: string, params: unknown[]) => {
        const res = await fetch(env.RPC_URL.split(",")[0], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
        return (await res.json()).result;
      };

      const admin = await make("admin");
      db.update(users).set({ role: "admin" }).where(eq(users.id, admin.id)).run();
      const org = await make("organizer");
      const alice = await make("donor-alice");
      const bob = await make("donor-bob");
      const attestors = [await make("attestor"), await make("attestor")];

      // ---- organizer approved; a campaign with a 30-day deadline and a 7-day inactivity window, published
      const applyRoute = await import("@/app/api/v1/organizers/verify/route");
      const decisionRoute = await import("@/app/api/v1/admin/organizers/[id]/decision/route");
      const apply = await call(applyRoute.POST as never, org.cookie, {
        legalName: "Expiry Test Trust", registrationNumber: "EXP-1", jurisdiction: "India", documentHash: "a".repeat(64), documentName: "doc.pdf",
      });
      expect((await call(decisionRoute.POST as never, admin.cookie, { decision: "approve" }, apply.body.profile.id)).body.profile.chainSync).toBe("synced");

      const campaignsRoute = await import("@/app/api/v1/campaigns/route");
      const created = await call(campaignsRoute.POST as never, org.cookie, {
        title: "Local expiry test campaign", summary: "End to end test of closing a stalled campaign and refunding its donors.",
        category: "COMMUNITY", fundingGoalMinorUnits: "100000000", adminExpenseCapPct: 10, durationDays: 30, inactivityDays: 7,
        milestones: [
          { description: "First tranche: supplies delivered", targetPct: 50, requiredAttestations: 2 },
          { description: "Second tranche: work completed", targetPct: 50, requiredAttestations: 2 },
        ],
      });
      expect(created.status).toBe(201);
      const campaignId: string = created.body.campaign_id;
      const deployRoute = await import("@/app/api/v1/campaigns/[id]/deploy/route");
      const deployed = await call(deployRoute.POST as never, org.cookie, undefined, campaignId);
      if (deployed.body.campaign.chainStatus !== "deployed") log(`deploy failed: ${deployed.body.campaign.chainError}`);
      expect(deployed.body.campaign.chainStatus).toBe("deployed");
      const vault: string = deployed.body.campaign.vaultContractAddress;
      expect(deployed.body.campaign.deadlineAt).toBeTruthy();
      const defineRoute = await import("@/app/api/v1/campaigns/[id]/milestones/define/route");
      const defined = await call(defineRoute.POST as never, org.cookie, undefined, campaignId);
      expect(defined.body.result.status).toBe("defined");
      const m1: string = defined.body.campaign.milestones[0].id;
      const rolesRoute = await import("@/app/api/v1/admin/roles/route");
      for (const a of attestors) {
        const r = await rolesRoute.POST(
          new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json", cookie: admin.cookie }, body: JSON.stringify({ email: a.email, role: "attestor", active: true }) }),
        );
        expect((await r.json()).grant.chainSync).toBe("synced");
      }
      log("campaign published with a 30-day deadline and a 7-day inactivity window");

      // ---- two donors: alice 60 mINR, bob 20 mINR
      const donationsRoute = await import("@/app/api/v1/donations/route");
      const advanceRoute = await import("@/app/api/v1/donations/[id]/advance/route");
      const donate = async (who: typeof alice, amount: string) => {
        const started = await call(donationsRoute.POST as never, who.cookie, { campaignId, amountMinorUnits: amount });
        expect(started.status).toBe(201);
        let donation = started.body.donation;
        for (let i = 0; i < 40 && donation.status === "PENDING"; i++) {
          donation = (await call(advanceRoute.POST as never, who.cookie, undefined, started.body.donation_id)).body.donation;
          await new Promise((r) => setTimeout(r, 500));
        }
        expect(donation.status).toBe("CONFIRMED");
      };
      await donate(alice, "60000000");
      await donate(bob, "20000000");

      // ---- milestone 1 verified and released: 50% of 80 = 40 mINR to the organizer, 40 stays in the vault
      const attestRoute = await import("@/app/api/v1/milestones/[id]/attestations/route");
      const releaseRoute = await import("@/app/api/v1/milestones/[id]/release/route");
      const proof = `0x${"ef".repeat(32)}`;
      for (const a of attestors) expect((await call(attestRoute.POST as never, a.cookie, { proofHash: proof }, m1)).status).toBe(200);
      const released = await call(releaseRoute.POST as never, org.cookie, undefined, m1);
      expect(released.body.milestone.state.status).toBe("Released");
      log("milestone 1 released: 40 mINR to the organizer; 40 mINR still in the vault");

      // ---- too early: the vault itself refuses, and the reason reaches the user
      const closeRoute = await import("@/app/api/v1/campaigns/[id]/close/route");
      const refundRoute = await import("@/app/api/v1/campaigns/[id]/refund/route");
      const early = await call(closeRoute.POST as never, bob.cookie, undefined, campaignId);
      expect(early.status).toBe(422);
      expect(early.body.error.message).toContain("cannot be closed yet");
      const beforeClose = await call(refundRoute.GET as never, alice.cookie, undefined, campaignId, "GET");
      expect(beforeClose.body.refund).toEqual({ closed: false, claimed: false, amountMinorUnits: "0" });
      const tooSoonClaim = await call(refundRoute.POST as never, alice.cookie, undefined, campaignId);
      expect([tooSoonClaim.status, tooSoonClaim.body.error.code]).toEqual([409, "NOT_CLOSED"]);
      log("an early close was refused by the contract; a claim before the close was refused");

      // ---- 8 days pass with no further release: the campaign is stalled and anyone can close it
      await rpc("evm_increaseTime", [8 * 86_400]);
      await rpc("evm_mine", []);
      const closed = await call(closeRoute.POST as never, bob.cookie, undefined, campaignId);
      if (closed.status !== 200) log(`close failed: ${closed.status} ${JSON.stringify(closed.body)}`);
      expect(closed.status).toBe(200);
      const again = await call(closeRoute.POST as never, bob.cookie, undefined, campaignId);
      expect(again.status).toBe(422);
      log("closed after 8 days without a release; a second close was refused");

      // ---- refunds: alice 30 of the 40, bob 10, each once, to their own wallets
      const client = createPublicClient({ chain: polygonAmoy, transport: http(env.RPC_URL.split(",")[0]) });
      const token = env.MOCK_INR_ADDRESS as `0x${string}`;
      const balanceOf = (a: string) => client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [a as `0x${string}`] });
      const aliceBefore = await balanceOf(alice.walletAddress);
      const bobBefore = await balanceOf(bob.walletAddress);

      const aliceView = await call(refundRoute.GET as never, alice.cookie, undefined, campaignId, "GET");
      expect(aliceView.body.refund).toEqual({ closed: true, claimed: false, amountMinorUnits: "30000000" });
      const outsider = await make("outsider");
      const outsiderTry = await call(refundRoute.POST as never, outsider.cookie, undefined, campaignId);
      expect([outsiderTry.status, outsiderTry.body.error.code]).toEqual([409, "NO_REFUND_DUE"]);

      const aliceClaim = await call(refundRoute.POST as never, alice.cookie, undefined, campaignId);
      if (aliceClaim.status !== 200) log(`alice claim failed: ${JSON.stringify(aliceClaim.body)}`);
      expect(aliceClaim.status).toBe(200);
      const bobClaim = await call(refundRoute.POST as never, bob.cookie, undefined, campaignId);
      expect(bobClaim.status).toBe(200);
      expect((await call(refundRoute.POST as never, alice.cookie, undefined, campaignId)).body.error.code).toBe("NO_REFUND_DUE");

      expect((await balanceOf(alice.walletAddress)) - aliceBefore).toBe(30_000_000n);
      expect((await balanceOf(bob.walletAddress)) - bobBefore).toBe(10_000_000n);
      expect(await balanceOf(vault)).toBe(0n);
      log("alice got 30 mINR and bob 10 mINR; the vault is empty; a second claim was refused");

      // ---- a closed vault takes no more donations and pays out nothing further
      const lateDonation = await call(donationsRoute.POST as never, alice.cookie, { campaignId, amountMinorUnits: "1000000" });
      expect(lateDonation.status).toBe(201); // the app cannot see the close until it is indexed; the contract is the gate
      let lateStatus = "PENDING";
      for (let i = 0; i < 40 && lateStatus === "PENDING"; i++) {
        lateStatus = (await call(advanceRoute.POST as never, alice.cookie, undefined, lateDonation.body.donation_id)).body?.donation?.status ?? "PENDING";
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(lateStatus).not.toBe("CONFIRMED");
      expect(await balanceOf(vault)).toBe(0n);
      log(`a donation to the closed vault was not accepted (${lateStatus})`);

      // ---- the public ledger shows the close and the refunds, and reconciles to the chain
      const ledgerRoute = await import("@/app/api/v1/campaigns/[id]/ledger/route");
      let ledger: { escrow: { heldMinorUnits: string; totalRefundedMinorUnits: string }; expiry: { state: string; closed: { reason: string; refundPool: string } | null; refundCount: number }; reconciliation: { status: string } } | null = null;
      for (let i = 0; i < 40; i++) {
        const res = await ledgerRoute.GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: campaignId }) });
        ledger = await res.json();
        if (ledger!.expiry.refundCount === 2 && ledger!.reconciliation.status === "match") break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      log(`ledger: ${ledger!.expiry.state}, refunded ${ledger!.escrow.totalRefundedMinorUnits}, reconciliation ${ledger!.reconciliation.status}`);
      expect(ledger!.expiry.state).toBe("closed");
      expect(ledger!.expiry.closed).toMatchObject({ reason: "inactivity", refundPool: "40000000" });
      expect(ledger!.expiry.refundCount).toBe(2);
      expect(ledger!.escrow.totalRefundedMinorUnits).toBe("40000000");
      expect(ledger!.escrow.heldMinorUnits).toBe("0");
      expect(ledger!.reconciliation.status).toBe("match");
    },
    300_000,
  );
});
