/**
 * OPT-IN end-to-end run against a LOCAL anvil chain (0 POL): the real route handlers, the real
 * viem chain modules (manager, registry, disbursement) and the real indexer reader, with every
 * contract deployed on anvil. It exists because the unit tests use fake chains, so this is the only
 * automated proof that the real `lib/chain/disbursement.ts` and its ABIs work. See docs/manual_test.md
 * for starting anvil and deploying the five contracts; then:
 *
 *   LIVE_LOCAL=1 RPC_URL=http://127.0.0.1:8545 MOCK_INR_ADDRESS=... FACTORY_ADDRESS=... \
 *   MILESTONE_MANAGER_ADDRESS=... BENEFICIARY_REGISTRY_ADDRESS=... DISBURSEMENT_ADDRESS=... \
 *   FACTORY_OWNER_KEY=<anvil account 0> npx vitest run lib/disbursement/live-local.test.ts
 *
 * It refuses to run against anything but localhost, so it can never spend testnet POL.
 */
import { eq } from "drizzle-orm";
import { createPublicClient, erc20Abi, http, parseAbi } from "viem";
import { polygonAmoy } from "viem/chains";
import { describe, expect, it } from "vitest";

const live = process.env.LIVE_LOCAL === "1";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(process.env.RPC_URL ?? "");

describe.skipIf(!live)("local anvil: release, register a beneficiary, record the payout", () => {
  it(
    "records a payout only when the rules are met, and the public ledger reconciles",
    async () => {
      if (!isLocal) throw new Error("LIVE_LOCAL only runs against a local RPC (RPC_URL must be 127.0.0.1 or localhost).");
      Object.assign(process.env, {
        DATABASE_URL: ":memory:",
        AUTH_SECRET: "s".repeat(40),
        WALLET_ENCRYPTION_KEY: "ab".repeat(32),
        INDEXER_START_BLOCK: "0",
        MANAGER_START_BLOCK: "0",
        REGISTRY_START_BLOCK: "0",
        DISBURSEMENT_START_BLOCK: "0",
      });
      const { resetEnvCache, getEnv } = await import("@/lib/env");
      resetEnvCache();
      const { getDb, resetDbForTests } = await import("@/lib/db");
      resetDbForTests();
      const { signSession } = await import("@/lib/auth/session");
      const { getWalletKeyEnc, registerDonor } = await import("@/lib/auth/users");
      const { users, disbursements } = await import("@/lib/db/schema");
      const { disbursementChain } = await import("@/lib/chain/disbursement");
      const env = getEnv();
      const db = getDb();
      const log = (m: string) => console.log(`[local] ${m}`);

      let n = 0;
      const stamp = Date.now();
      const make = async (label: string) => {
        const u = await registerDonor(db, { email: `${label}-${stamp}-${++n}@example.com`, password: "correct-horse-battery" }, env.WALLET_ENCRYPTION_KEY);
        return { ...u, cookie: `vera_session=${await signSession({ userId: u.id, role: "donor" })}` };
      };
      const call = async (handler: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response>, cookie: string, body?: unknown, id = "x") => {
        const res = await handler(
          new Request("http://localhost/x", {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: body === undefined ? undefined : JSON.stringify(body),
          }),
          { params: Promise.resolve({ id }) },
        );
        return { status: res.status, body: await res.json().catch(() => null) };
      };

      const admin = await make("admin");
      db.update(users).set({ role: "admin" }).where(eq(users.id, admin.id)).run();
      const org = await make("organizer");
      const donor = await make("donor");
      const attestors = [await make("attestor"), await make("attestor")];

      // ---- organizer approved, campaign published, milestones registered (50% + 50%)
      const applyRoute = await import("@/app/api/v1/organizers/verify/route");
      const decisionRoute = await import("@/app/api/v1/admin/organizers/[id]/decision/route");
      const apply = await call(applyRoute.POST as never, org.cookie, {
        legalName: "Local Test Trust", registrationNumber: "LOCAL-1", jurisdiction: "India", documentHash: "a".repeat(64), documentName: "doc.pdf",
      });
      expect(apply.status).toBe(201);
      expect((await call(decisionRoute.POST as never, admin.cookie, { decision: "approve" }, apply.body.profile.id)).body.profile.chainSync).toBe("synced");

      const campaignsRoute = await import("@/app/api/v1/campaigns/route");
      const created = await call(campaignsRoute.POST as never, org.cookie, {
        title: "Local payout test campaign", summary: "End to end test of release, beneficiary registration and payout.",
        category: "COMMUNITY", fundingGoalMinorUnits: "100000000", adminExpenseCapPct: 10,
        milestones: [
          { description: "First tranche: supplies delivered", targetPct: 50, requiredAttestations: 2 },
          { description: "Second tranche: work completed", targetPct: 50, requiredAttestations: 2 },
        ],
      });
      expect(created.status).toBe(201);
      const campaignId: string = created.body.campaign_id;
      const deployRoute = await import("@/app/api/v1/campaigns/[id]/deploy/route");
      const deployed = await call(deployRoute.POST as never, org.cookie, undefined, campaignId);
      expect(deployed.body.campaign.chainStatus).toBe("deployed");
      const vault: string = deployed.body.campaign.vaultContractAddress;
      const defineRoute = await import("@/app/api/v1/campaigns/[id]/milestones/define/route");
      const defined = await call(defineRoute.POST as never, org.cookie, undefined, campaignId);
      if (defined.body.result.status !== "defined") log(`define failed: ${defined.body.result.error}`);
      expect(defined.body.result.status).toBe("defined");
      const [m1, m2] = defined.body.campaign.milestones.map((m: { id: string }) => m.id);

      const rolesRoute = await import("@/app/api/v1/admin/roles/route");
      for (const a of attestors) {
        const r = await rolesRoute.POST(
          new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json", cookie: admin.cookie }, body: JSON.stringify({ email: a.email, role: "attestor", active: true }) }),
        );
        expect((await r.json()).grant.chainSync).toBe("synced");
      }

      // ---- donor gives 60 mINR; milestone 1 is verified and released: 50% of 60 = 30 mINR to the organizer
      const donationsRoute = await import("@/app/api/v1/donations/route");
      const advanceRoute = await import("@/app/api/v1/donations/[id]/advance/route");
      const started = await call(donationsRoute.POST as never, donor.cookie, { campaignId, amountMinorUnits: "60000000" });
      expect(started.status).toBe(201);
      let donation = started.body.donation;
      for (let i = 0; i < 40 && donation.status === "PENDING"; i++) {
        donation = (await call(advanceRoute.POST as never, donor.cookie, undefined, started.body.donation_id)).body.donation;
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(donation.status).toBe("CONFIRMED");

      const attestRoute = await import("@/app/api/v1/milestones/[id]/attestations/route");
      const releaseRoute = await import("@/app/api/v1/milestones/[id]/release/route");
      const proof = `0x${"ef".repeat(32)}`;
      for (const a of attestors) expect((await call(attestRoute.POST as never, a.cookie, { proofHash: proof }, m1)).status).toBe(200);
      const released = await call(releaseRoute.POST as never, org.cookie, undefined, m1);
      expect(released.body.milestone.state.status).toBe("Released");
      log("milestone 1 released: 30 mINR to the organizer");

      // ---- beneficiary registered through the real registry
      const beneficiariesRoute = await import("@/app/api/v1/campaigns/[id]/beneficiaries/route");
      const H1 = `0x${"a1".repeat(32)}`;
      const registered = await call(beneficiariesRoute.POST as never, org.cookie, { identityHash: H1, payoutMethod: "bank transfer" }, campaignId);
      expect(registered.status).toBe(201);
      const beneficiaryId: string = registered.body.beneficiary.id;
      const unregisteredId = "not-a-beneficiary";

      const disburseRoute = await import("@/app/api/v1/milestones/[id]/disburse/route");
      const disburse = (cookie: string, id: string, body: unknown) => call(disburseRoute.POST as never, cookie, body, id);

      // ---- refusals, each with the plain-language reason
      const donorTry = await disburse(donor.cookie, m1, { beneficiaryId, amountMinorUnits: "30000000" });
      expect(donorTry.status).toBe(403);
      const unreleased = await disburse(org.cookie, m2, { beneficiaryId, amountMinorUnits: "1000000" });
      expect([unreleased.status, unreleased.body.error.code]).toEqual([409, "MILESTONE_NOT_RELEASED"]);
      const nobody = await disburse(org.cookie, m1, { beneficiaryId: unregisteredId, amountMinorUnits: "1000000" });
      expect([nobody.status, nobody.body.error.code]).toEqual([404, "BENEFICIARY_NOT_FOUND"]);
      const tooMuch = await disburse(org.cookie, m1, { beneficiaryId, amountMinorUnits: "30000001" });
      expect([tooMuch.status, tooMuch.body.error.code]).toEqual([409, "EXCEEDS_RELEASED"]);
      log("app pre-checks refused: donor, unreleased milestone, unknown beneficiary, more than released");

      // The contract itself refuses too, with its reason mapped to a sentence, even if the app were bypassed.
      const orgKey = getWalletKeyEnc(db, org.id)!;
      const chain = disbursementChain();
      const bypass = await chain.disburse({ address: org.walletAddress, keyEnc: orgKey }, vault, 1, H1, "1000000", `0x${"cd".repeat(32)}`, () => undefined);
      expect(bypass).toMatchObject({ ok: false, error: "This milestone has not been released yet." });
      const zeroRef = await chain.disburse({ address: org.walletAddress, keyEnc: orgKey }, vault, 0, H1, "1000000", `0x${"0".repeat(64)}`, () => undefined);
      expect(zeroRef).toMatchObject({ ok: false, error: "A payout needs an off-ramp reference." });
      const strangerKey = getWalletKeyEnc(db, donor.id)!;
      const notOrganizer = await chain.disburse({ address: donor.walletAddress, keyEnc: strangerKey }, vault, 0, H1, "1000000", `0x${"cd".repeat(32)}`, () => undefined);
      expect(notOrganizer).toMatchObject({ ok: false, error: "Only the campaign's organizer can record a payout." });
      log("contract refusals mapped to plain sentences");

      // ---- the payout: approve, then disburse, as the organizer
      const paid = await disburse(admin.cookie, m1, { beneficiaryId, amountMinorUnits: "30000000" });
      if (paid.status !== 201) log(`payout failed: ${paid.status} ${JSON.stringify(paid.body)}`);
      expect(paid.status).toBe(201);
      expect(paid.body.disbursement).toMatchObject({ status: "CONFIRMED", amountMinorUnits: "30000000", identityHash: H1 });
      const row = db.select().from(disbursements).get()!;
      expect(row.approveTxHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(row.txHash).toMatch(/^0x[0-9a-f]{64}$/);
      log("payout recorded (an admin asked; the organizer signed)");

      const again = await disburse(org.cookie, m1, { beneficiaryId, amountMinorUnits: "1000000" });
      expect([again.status, again.body.error.code]).toEqual([409, "ALREADY_DISBURSED"]);

      // ---- independent verification straight from the chain
      const client = createPublicClient({ chain: polygonAmoy, transport: http(env.RPC_URL) });
      const disbursement = env.DISBURSEMENT_ADDRESS as `0x${string}`;
      const dAbi = parseAbi([
        "function disbursedTotal(address) view returns (uint256)",
        "function isDisbursed(address,uint256) view returns (bool)",
        "event PayoutRecorded(address indexed vault, uint256 indexed milestoneIndex, bytes32 indexed identityHash, uint256 amount, bytes32 payoutRef, address organizer)",
      ]);
      expect(await client.readContract({ address: disbursement, abi: dAbi, functionName: "disbursedTotal", args: [vault as `0x${string}`] })).toBe(30_000_000n);
      expect(await client.readContract({ address: disbursement, abi: dAbi, functionName: "isDisbursed", args: [vault as `0x${string}`, 0n] })).toBe(true);
      const balanceOf = (a: string) => client.readContract({ address: env.MOCK_INR_ADDRESS as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [a as `0x${string}`] });
      expect(await balanceOf(disbursement)).toBe(30_000_000n);
      expect(await balanceOf(org.walletAddress)).toBe(0n);
      const logs = await client.getLogs({ address: disbursement, event: dAbi[2], fromBlock: 0n });
      expect(logs).toHaveLength(1);
      expect(logs[0].args).toMatchObject({ vault: expect.stringMatching(new RegExp(vault, "i")), milestoneIndex: 0n, identityHash: H1, amount: 30_000_000n });
      expect(logs[0].args.payoutRef).toBe(row.payoutRefHash);
      log("chain: 30 mINR now rests in the Disbursement contract; the event carries the reference hash");

      // ---- the public ledger shows the payout and the reconciliation includes it
      const ledgerRoute = await import("@/app/api/v1/campaigns/[id]/ledger/route");
      let ledger: { payouts: { entries: { amount: string; identityHash: string }[]; totalMinorUnits: string }; reconciliation: { status: string; payouts: string }; escrow: { heldMinorUnits: string } } | null = null;
      for (let i = 0; i < 40; i++) {
        const res = await ledgerRoute.GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: campaignId }) });
        ledger = await res.json();
        if (ledger!.payouts.entries.length === 1 && ledger!.reconciliation.status === "match") break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      log(`ledger: payouts ${ledger!.payouts.totalMinorUnits}, reconciliation ${ledger!.reconciliation.status}/${ledger!.reconciliation.payouts}`);
      expect(ledger!.payouts.entries).toHaveLength(1);
      expect(ledger!.payouts.entries[0]).toMatchObject({ amount: "30000000", identityHash: H1 });
      expect(ledger!.payouts.totalMinorUnits).toBe("30000000");
      expect(ledger!.escrow.heldMinorUnits).toBe("30000000"); // payouts leave the organizer's wallet, not the vault
      expect(ledger!.reconciliation).toMatchObject({ status: "match", payouts: "match" });

      const exportRoute = await import("@/app/api/v1/campaigns/[id]/export/route");
      const csv = await (await exportRoute.GET(new Request("http://localhost/x?format=csv"), { params: Promise.resolve({ id: campaignId }) })).text();
      const payoutLine = csv.split("\r\n").find((l) => l.includes(",PayoutRecorded,"));
      expect(payoutLine).toContain(`,30000000,30,`);
      expect(payoutLine).toContain(H1);
      expect(payoutLine).toContain(row.payoutRefHash);
    },
    300_000,
  );
});
