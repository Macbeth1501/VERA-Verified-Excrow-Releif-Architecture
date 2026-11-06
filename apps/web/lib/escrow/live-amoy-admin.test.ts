/**
 * OPT-IN run against the real Polygon Amoy MilestoneManager: the admin controls for the council-approval
 * limit (C2) and the council approvals needed K (C4), through the real viem chain module. It CHANGES
 * LIVE SETTINGS and puts them back, so it only runs when LIVE_AMOY=1 and FACTORY_OWNER_KEY are set:
 *
 *   LIVE_AMOY=1 FACTORY_OWNER_KEY=0x... npx vitest run lib/escrow/live-amoy-admin.test.ts
 *
 * It reads the current values first, changes each once, reads it back, checks the contract's own floor
 * (K below 2, refused when simulated, so no gas), and restores both in a `finally`, then reads them back
 * again. COST: four sponsored transactions, roughly 0.01 POL in all. It refuses to start under 1 POL.
 * Nothing local is touched; run it in the background with output sent to a file.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createPublicClient, fallback, http } from "viem";
import { polygonAmoy } from "viem/chains";
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

describe.skipIf(!live)("live Amoy: admin changes the council limit and K, then restores them", () => {
  it(
    "reads, changes, verifies the floor, and restores both settings",
    async () => {
      loadEnvLocal();
      const { resetEnvCache } = await import("@/lib/env");
      resetEnvCache();
      const { createEscrowChain } = await import("@/lib/chain/manager");
      const { getReleaseLimit, setReleaseLimit } = await import("@/lib/escrow/limits");
      const log = (m: string) => console.log(`[live-admin] ${m}`);

      const client = createPublicClient({ chain: polygonAmoy, transport: fallback(process.env.RPC_URL!.split(",").map((u) => http(u.trim()))) });
      const { privateKeyToAccount } = await import("viem/accounts");
      const sponsor = privateKeyToAccount(process.env.FACTORY_OWNER_KEY as `0x${string}`).address;
      const balance = await client.getBalance({ address: sponsor });
      log(`sponsor balance ${Number(balance) / 1e18} POL`);
      if (balance < 1_000_000_000_000_000_000n) throw new Error("Refusing to run with less than 1 POL in the sponsor wallet.");

      const chain = createEscrowChain();
      expect(chain.configured()).toBe(true);
      const before = await getReleaseLimit(chain);
      const k0 = await chain.readCouncilThreshold();
      log(`current: limit ${before.limitMinorUnits}, K ${k0}`);
      expect(before.limitMinorUnits).not.toBeNull();
      expect(k0).not.toBeNull();
      const limit0 = before.limitMinorUnits!;

      let limitChanged = false;
      let kChanged = false;
      try {
        const limitTarget = (BigInt(limit0) + 500_000n).toString(); // 0.5 rupee above the current value
        const setLimit = await setReleaseLimit(chain, limitTarget);
        limitChanged = true;
        expect(setLimit.ok).toBe(true);
        expect((await getReleaseLimit(chain)).limitMinorUnits).toBe(limitTarget);
        log(`limit changed to ${limitTarget} and read back`);

        const kTarget = k0 === 2 ? 3 : 2;
        const setK = await chain.setCouncilThreshold(kTarget);
        kChanged = true;
        expect(setK.ok).toBe(true);
        expect(await chain.readCouncilThreshold()).toBe(kTarget);
        log(`K changed to ${kTarget} and read back`);

        // The contract's own floor: refused in simulation, so no transaction and no gas.
        const floor = await chain.setCouncilThreshold(1);
        expect(floor.ok).toBe(false);
        expect(!floor.ok && floor.error).toMatch(/at least 2 approvals/);
        expect(await chain.readCouncilThreshold()).toBe(kTarget);
        log("K=1 refused by the contract");
      } finally {
        if (limitChanged) {
          const restored = await setReleaseLimit(chain, limit0);
          log(`restore limit: ${restored.ok ? "ok" : "FAILED " + JSON.stringify(restored)}`);
        }
        if (kChanged) {
          const restored = await chain.setCouncilThreshold(k0!);
          log(`restore K: ${restored.ok ? "ok" : "FAILED " + JSON.stringify(restored)}`);
        }
      }
      expect((await getReleaseLimit(chain)).limitMinorUnits).toBe(limit0);
      expect(await chain.readCouncilThreshold()).toBe(k0);
      log("both settings are back to their original values");
    },
    300_000,
  );
});
