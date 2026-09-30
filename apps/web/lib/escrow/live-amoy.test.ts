/**
 * OPT-IN end-to-end run against the real Polygon Amoy testnet: the real route handlers, the real
 * MilestoneManager, real transactions signed by generated wallets. It spends a little testnet POL
 * from the sponsor wallet, so it only runs when LIVE_AMOY=1 and FACTORY_OWNER_KEY are set:
 *
 *   LIVE_AMOY=1 FACTORY_OWNER_KEY=0x... npx vitest run lib/escrow/live-amoy.test.ts
 *
 * The database is in memory; nothing local is touched, but the contracts and vaults are real.
 *
 * HOW TO RUN: it takes 10-25 minutes (about 35 sequential transactions; its own limit is 35 minutes), so
 * never run it in a foreground command with a shell timeout, and never pipe it through tail/head:
 * a shell cutoff kills it mid-run (exit 143) after POL is spent, and it cannot resume (a new
 * in-memory database and a new campaign each run). Run it in the background with output sent to a
 * log file, and follow the "[live]" lines in that file:
 *
 *   LIVE_AMOY=1 npx vitest run lib/escrow/live-amoy.test.ts > live.log 2>&1
 *
 * It also ends with a real beneficiary registration and a real 30 mINR payout through the Disbursement
 * contract (needs DISBURSEMENT_ADDRESS in .env.local), so the whole chain is proven on Amoy.
 *
 * COST: about 0.3-0.5 POL per run (0.283 measured at 50 gwei, plus a few cents for the payout) (publishing the vault alone is about 0.2 POL, and the
 * throwaway wallets it creates keep their leftover gas, which cannot be recovered). It refuses to
 * start with less than 1 POL in the sponsor wallet, or when gas is above the app's ceiling.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createPublicClient, erc20Abi, fallback, http, parseAbi } from "viem";
import { polygonAmoy } from "viem/chains";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

const live = Boolean(process.env.LIVE_AMOY && process.env.FACTORY_OWNER_KEY);

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
  process.env.DATABASE_URL = ":memory:";
}

describe.skipIf(!live)("live Amoy: publish, attest, approve, release", () => {
  it(
    "moves real money only when the rules are met",
    async () => {
      loadEnvLocal();
      // The fresh in-memory database has nothing to catch up on before this run, so start every indexer
      // stream just before it. Scanning from the Factory's deploy block (about 960,000 blocks, in 2,000-block
      // reads) is what pushed the public-ledger step past the old 900 s limit on 2026-09-30.
      {
        const head = await createPublicClient({ chain: polygonAmoy, transport: fallback(process.env.RPC_URL!.split(",").map((u) => http(u.trim()))) }).getBlockNumber();
        const start = String(head - 5n);
        for (const k of ["INDEXER_START_BLOCK", "MANAGER_START_BLOCK", "REGISTRY_START_BLOCK", "DISBURSEMENT_START_BLOCK"]) process.env[k] = start;
      }
      const { resetEnvCache } = await import("@/lib/env");
      resetEnvCache();
      const { getDb, resetDbForTests } = await import("@/lib/db");
      resetDbForTests();
      const { signSession } = await import("@/lib/auth/session");
      const { registerDonor } = await import("@/lib/auth/users");
      const { users } = await import("@/lib/db/schema");
      const { getEnv } = await import("@/lib/env");
      const env = getEnv();
      const db = getDb();
      const log = (m: string) => console.log(`[live] ${m}`);

      // Guard the sponsor wallet before spending anything.
      const { privateKeyToAccount } = await import("viem/accounts");
      const { gasPriceRefusal } = await import("@/lib/chain/sponsor");
      const guardClient = createPublicClient({ chain: polygonAmoy, transport: fallback(env.RPC_URL.split(",").map((u) => http(u.trim()))) });
      const sponsorPol = await guardClient.getBalance({ address: privateKeyToAccount(env.FACTORY_OWNER_KEY as `0x${string}`).address });
      log(`sponsor holds ${Number(sponsorPol) / 1e18} POL`);
      if (sponsorPol < 1_000_000_000_000_000_000n) throw new Error("Sponsor wallet holds less than 1 POL; top it up before running the live test.");
      const refusal = gasPriceRefusal(await guardClient.getGasPrice());
      if (refusal) throw new Error(refusal);

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
      const council = [await make("council"), await make("council"), await make("council")];

      // ---- organizer applies, admin approves (mirrored on the Factory)
      const applyRoute = await import("@/app/api/v1/organizers/verify/route");
      const decisionRoute = await import("@/app/api/v1/admin/organizers/[id]/decision/route");
      const apply = await call(applyRoute.POST as never, org.cookie, {
        legalName: "Live Test Trust", registrationNumber: "LIVE-1", jurisdiction: "India", documentHash: "a".repeat(64), documentName: "doc.pdf",
      });
      expect(apply.status).toBe(201);
      const decision = await call(decisionRoute.POST as never, admin.cookie, { decision: "approve" }, apply.body.profile.id);
      expect(decision.body.profile.chainSync).toBe("synced");
      log("organizer approved on-chain");

      // ---- campaign: two milestones, 40% then 60%, each needing 2 confirmations
      const campaignsRoute = await import("@/app/api/v1/campaigns/route");
      const created = await call(campaignsRoute.POST as never, org.cookie, {
        title: "Live escrow test campaign", summary: "End to end test of attestation, council approval and release.",
        category: "COMMUNITY", fundingGoalMinorUnits: "500000000", adminExpenseCapPct: 10,
        milestones: [
          { description: "First tranche: supplies delivered", targetPct: 40, requiredAttestations: 2 },
          { description: "Second tranche: work completed", targetPct: 60, requiredAttestations: 2 },
        ],
      });
      expect(created.status).toBe(201);
      const campaignId: string = created.body.campaign_id;
      const deployRoute = await import("@/app/api/v1/campaigns/[id]/deploy/route");
      const deployed = await call(deployRoute.POST as never, org.cookie, undefined, campaignId);
      if (deployed.body.campaign.chainStatus !== "deployed") log(`deploy failed: ${deployed.body.campaign.chainError}`);
      expect(deployed.body.campaign.chainStatus).toBe("deployed");
      const vault: string = deployed.body.campaign.vaultContractAddress;
      log(`vault ${vault}`);

      const defineRoute = await import("@/app/api/v1/campaigns/[id]/milestones/define/route");
      const defined = await call(defineRoute.POST as never, org.cookie, undefined, campaignId);
      expect(defined.body.result.status).toBe("defined");
      log("milestones registered on the manager");
      const [m1, m2] = defined.body.campaign.milestones.map((m: { id: string }) => m.id);

      // ---- admin registers attestors and council on the contract
      const rolesRoute = await import("@/app/api/v1/admin/roles/route");
      for (const [who, role] of [...attestors.map((a) => [a, "attestor"] as const), ...council.map((c) => [c, "council"] as const)]) {
        const r = await rolesRoute.POST(
          new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json", cookie: admin.cookie }, body: JSON.stringify({ email: who.email, role, active: true }) }),
        );
        expect((await r.json()).grant.chainSync).toBe("synced");
      }
      log("roles registered on the contract");

      // ---- donor gives 250 mINR (250,000,000 minor units)
      const donationsRoute = await import("@/app/api/v1/donations/route");
      const advanceRoute = await import("@/app/api/v1/donations/[id]/advance/route");
      const started = await call(donationsRoute.POST as never, donor.cookie, { campaignId, amountMinorUnits: "250000000" });
      expect(started.status).toBe(201);
      let donation = started.body.donation;
      for (let i = 0; i < 40 && donation.status === "PENDING"; i++) {
        donation = (await call(advanceRoute.POST as never, donor.cookie, undefined, started.body.donation_id)).body.donation;
        await new Promise((r) => setTimeout(r, 1500));
      }
      expect(donation.status).toBe("CONFIRMED");
      log("donation confirmed");

      const attestRoute = await import("@/app/api/v1/milestones/[id]/attestations/route");
      const approveRoute = await import("@/app/api/v1/milestones/[id]/council-approval/route");
      const releaseRoute = await import("@/app/api/v1/milestones/[id]/release/route");
      const proof = `0x${"ef".repeat(32)}`;

      // ---- milestone 1: below the limit, so attestors alone release it
      const a1 = await call(attestRoute.POST as never, attestors[0].cookie, { proofHash: proof }, m1);
      if (a1.status !== 200) log(`attestation 1 failed: ${a1.status} ${JSON.stringify(a1.body)}`);
      expect(a1.body.threshold_met).toBe(false);
      expect(a1.body.milestone.state.status).toBe("Pending");
      const early = await call(releaseRoute.POST as never, org.cookie, undefined, m1);
      expect(early.status).toBe(409);
      const a2 = await call(attestRoute.POST as never, attestors[1].cookie, { proofHash: proof }, m1);
      if (a2.status !== 200) log(`attestation 2 failed: ${a2.status} ${JSON.stringify(a2.body)}`);
      expect(a2.body.threshold_met).toBe(true);
      log("milestone 1 verified by 2 attestors");
      const r1 = await call(releaseRoute.POST as never, org.cookie, undefined, m1);
      expect(r1.status).toBe(200);
      expect(r1.body.milestone.state.status).toBe("Released");
      log("milestone 1 released without the council");

      // ---- milestone 2: 150 mINR is above the 100 limit, so it needs 3 council approvals
      await call(attestRoute.POST as never, attestors[0].cookie, { proofHash: proof }, m2);
      await call(attestRoute.POST as never, attestors[1].cookie, { proofHash: proof }, m2);
      for (const c of council.slice(0, 2)) {
        const ok = await call(approveRoute.POST as never, c.cookie, undefined, m2);
        expect(ok.status).toBe(200);
      }
      const blocked = await call(releaseRoute.POST as never, org.cookie, undefined, m2);
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.message).toContain("needs 3 council approvals; it has 2");
      log("2 council approvals: release refused");
      expect((await call(approveRoute.POST as never, council[2].cookie, undefined, m2)).status).toBe(200);
      const r2 = await call(releaseRoute.POST as never, org.cookie, undefined, m2);
      expect(r2.status).toBe(200);
      log("milestone 2 released with 3 council approvals");

      // ---- independent verification straight from the chain, not through the app
      const client = createPublicClient({ chain: polygonAmoy, transport: fallback(env.RPC_URL.split(",").map((u) => http(u.trim()))) });
      const manager = env.MILESTONE_MANAGER_ADDRESS as `0x${string}`;
      const releasedTotal = await client.readContract({
        address: manager, abi: parseAbi(["function releasedTotal(address) view returns (uint256)"]), functionName: "releasedTotal", args: [vault as `0x${string}`],
      });
      const organizerBalance = await client.readContract({ address: env.MOCK_INR_ADDRESS as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [org.walletAddress as `0x${string}`] });
      const vaultBalance = await client.readContract({ address: vault as `0x${string}`, abi: parseAbi(["function getBalance() view returns (uint256)"]), functionName: "getBalance" });
      log(`chain: released ${releasedTotal}, organizer holds ${organizerBalance}, vault holds ${vaultBalance}`);
      expect(releasedTotal).toBe(250_000_000n);
      expect(organizerBalance).toBe(250_000_000n);
      expect(vaultBalance).toBe(0n);

      // ---- a beneficiary is registered on the real registry and paid 30 mINR through the real Disbursement contract
      expect(env.DISBURSEMENT_ADDRESS).toBeTruthy();
      const beneficiariesRoute = await import("@/app/api/v1/campaigns/[id]/beneficiaries/route");
      const disburseRoute = await import("@/app/api/v1/milestones/[id]/disburse/route");
      const H1 = `0x${"a1".repeat(32)}`;
      const registered = await call(beneficiariesRoute.POST as never, org.cookie, { identityHash: H1, payoutMethod: "bank transfer" }, campaignId);
      if (registered.status !== 201) log(`beneficiary failed: ${registered.status} ${JSON.stringify(registered.body)}`);
      expect(registered.status).toBe(201);
      log("beneficiary registered on the registry");
      const paid = await call(disburseRoute.POST as never, admin.cookie, { beneficiaryId: registered.body.beneficiary.id, amountMinorUnits: "30000000" }, m1);
      if (paid.status !== 201) log(`payout failed: ${paid.status} ${JSON.stringify(paid.body)}`);
      expect(paid.status).toBe(201);
      expect(paid.body.disbursement).toMatchObject({ status: "CONFIRMED", amountMinorUnits: "30000000", identityHash: H1 });
      const disbursement = env.DISBURSEMENT_ADDRESS as `0x${string}`;
      const dAbi = parseAbi(["function disbursedTotal(address) view returns (uint256)", "function isDisbursed(address,uint256) view returns (bool)"]);
      expect(await client.readContract({ address: disbursement, abi: dAbi, functionName: "disbursedTotal", args: [vault as `0x${string}`] })).toBe(30_000_000n);
      expect(await client.readContract({ address: disbursement, abi: dAbi, functionName: "isDisbursed", args: [vault as `0x${string}`, 0n] })).toBe(true);
      log(`payout recorded on Amoy: approve ${paid.body.disbursement.approveTxHash ?? "(existing allowance)"}, disburse ${paid.body.disbursement.txHash}`);

      // ---- the public ledger catches up, shows both releases and reconciles exactly
      const ledgerRoute = await import("@/app/api/v1/campaigns/[id]/ledger/route");
      let ledger: { escrow: { heldMinorUnits: string; totalReleasedMinorUnits: string }; payouts: { totalMinorUnits: string; entries: { amount: string; identityHash: string }[] }; reconciliation: { status: string }; ledger: { type: string }[] } | null = null;
      for (let i = 0; i < 40; i++) {
        const res = await ledgerRoute.GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: campaignId }) });
        ledger = await res.json();
        if (ledger!.escrow.totalReleasedMinorUnits === "250000000" && ledger!.payouts.totalMinorUnits === "30000000" && ledger!.reconciliation.status === "match") break;
        await new Promise((r) => setTimeout(r, 4000));
      }
      log(`ledger: held ${ledger!.escrow.heldMinorUnits}, released ${ledger!.escrow.totalReleasedMinorUnits}, reconciliation ${ledger!.reconciliation.status}`);
      expect(ledger!.escrow.heldMinorUnits).toBe("0");
      expect(ledger!.escrow.totalReleasedMinorUnits).toBe("250000000");
      expect(ledger!.reconciliation.status).toBe("match");
      expect(ledger!.payouts.entries).toHaveLength(1);
      expect(ledger!.payouts.entries[0]).toMatchObject({ amount: "30000000", identityHash: H1 });
      expect(ledger!.ledger.filter((e) => e.type === "MilestoneReleased")).toHaveLength(2);
      expect(ledger!.ledger.filter((e) => e.type === "MilestoneAttested")).toHaveLength(4);
      expect(ledger!.ledger.filter((e) => e.type === "CouncilApproved")).toHaveLength(3);
    },
    2_100_000, // 35 minutes
  );
});
