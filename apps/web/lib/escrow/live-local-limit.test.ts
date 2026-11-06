/**
 * OPT-IN run against a LOCAL anvil chain (0 POL): the admin council-approval limit through the real
 * viem chain module and the real MilestoneManager. Deploy the contracts as in docs/manual_test_local.md, then:
 *
 *   LIVE_LOCAL=1 RPC_URL=http://127.0.0.1:8545 MOCK_INR_ADDRESS=... MILESTONE_MANAGER_ADDRESS=... \
 *   FACTORY_OWNER_KEY=<anvil account 0> npx vitest run lib/escrow/live-local-limit.test.ts
 *
 * It refuses to run against anything but localhost, so it can never spend testnet POL.
 */
import { describe, expect, it } from "vitest";

const live = process.env.LIVE_LOCAL === "1";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(process.env.RPC_URL ?? "");

describe.skipIf(!live)("local anvil: the admin changes the council-approval limit", () => {
  it("reads the deployed limit, changes it from the sponsor wallet, and reads the new value back", async () => {
    if (!isLocal) throw new Error("LIVE_LOCAL only runs against a local RPC (RPC_URL must be 127.0.0.1 or localhost).");
    Object.assign(process.env, { DATABASE_URL: ":memory:", AUTH_SECRET: "s".repeat(40), WALLET_ENCRYPTION_KEY: "ab".repeat(32) });
    const { resetEnvCache } = await import("@/lib/env");
    resetEnvCache();
    const { createEscrowChain } = await import("@/lib/chain/manager");
    const { getReleaseLimit, setReleaseLimit } = await import("@/lib/escrow/limits");
    const chain = createEscrowChain();
    expect(chain.configured()).toBe(true);

    const before = await getReleaseLimit(chain);
    console.log(`[local] limit before: ${before.limitMinorUnits}`);
    expect(before.limitMinorUnits).not.toBeNull();

    const target = before.limitMinorUnits === "250500000" ? "100000000" : "250500000";
    const set = await setReleaseLimit(chain, target);
    expect(set.ok).toBe(true);
    expect((await getReleaseLimit(chain)).limitMinorUnits).toBe(target);

    // Zero is allowed (every release then needs the council), then restore the original value.
    expect((await setReleaseLimit(chain, "0")).ok).toBe(true);
    expect((await getReleaseLimit(chain)).limitMinorUnits).toBe("0");
    expect((await setReleaseLimit(chain, before.limitMinorUnits!)).ok).toBe(true);
    expect((await getReleaseLimit(chain)).limitMinorUnits).toBe(before.limitMinorUnits);
  }, 120_000);

  it("reads and changes the council threshold K, and the contract itself refuses K below 2", async () => {
    if (!isLocal) throw new Error("LIVE_LOCAL only runs against a local RPC (RPC_URL must be 127.0.0.1 or localhost).");
    Object.assign(process.env, { DATABASE_URL: ":memory:", AUTH_SECRET: "s".repeat(40), WALLET_ENCRYPTION_KEY: "ab".repeat(32) });
    const { resetEnvCache } = await import("@/lib/env");
    resetEnvCache();
    const { createEscrowChain } = await import("@/lib/chain/manager");
    const chain = createEscrowChain();

    const before = await chain.readCouncilThreshold();
    console.log(`[local] threshold before: ${before}`);
    expect(before).not.toBeNull();

    const target = before === 2 ? 3 : 2;
    expect((await chain.setCouncilThreshold(target)).ok).toBe(true);
    expect(await chain.readCouncilThreshold()).toBe(target);

    // The service refuses K < 2 first; here the chain module is called directly to show the contract's own floor.
    const floor = await chain.setCouncilThreshold(1);
    expect(floor.ok).toBe(false);
    expect(!floor.ok && floor.error).toMatch(/at least 2 approvals/);
    expect(await chain.readCouncilThreshold()).toBe(target);

    expect((await chain.setCouncilThreshold(before!)).ok).toBe(true);
    expect(await chain.readCouncilThreshold()).toBe(before);
  }, 120_000);
});
