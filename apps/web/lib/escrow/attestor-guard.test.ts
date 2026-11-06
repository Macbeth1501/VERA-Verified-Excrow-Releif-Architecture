/** C3: required confirmations may not exceed the number of active, on-chain-synced attestors. */

import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db";
import { makeDonor, makeLiveCampaign } from "../donations/test-setup";
import { FakeEscrowChain } from "./fake-chain";
import { attestationShortfalls, countSyncedRole, maxOpenRequirement, setRole } from "./service";

let db: Db;
let chain: FakeEscrowChain;

beforeEach(() => {
  db = createDb(":memory:");
  chain = new FakeEscrowChain();
});

async function addAttestor() {
  const user = await makeDonor(db);
  const r = await setRole(db, chain, { email: user.email, role: "attestor", active: true });
  expect(r.ok).toBe(true);
}

describe("countSyncedRole", () => {
  it("counts only attestors the contract knows, not failed or council ones", async () => {
    expect(countSyncedRole(db, "attestor")).toBe(0);
    await addAttestor();
    await addAttestor();
    const failing = await makeDonor(db);
    chain.failNext = "rpc down";
    await setRole(db, chain, { email: failing.email, role: "attestor", active: true });
    const council = await makeDonor(db);
    await setRole(db, chain, { email: council.email, role: "council", active: true });
    expect(countSyncedRole(db, "attestor")).toBe(2);
    expect(countSyncedRole(db, "council")).toBe(1);
  });
});

describe("attestationShortfalls", () => {
  it("accepts a requirement within the count", () => {
    expect(attestationShortfalls([{ requiredAttestations: 2 }, { requiredAttestations: 3 }], 3)).toEqual({});
  });

  it("rejects a requirement above the count, naming the milestone and the number", () => {
    const out = attestationShortfalls([{ requiredAttestations: 2 }, { requiredAttestations: 3 }], 2);
    expect(Object.keys(out)).toEqual(["1"]);
    expect(out[1]).toBe("Only 2 attestors are registered; ask an admin to add more or lower this number.");
  });

  it("gives a clear message when no attestor is registered", () => {
    const out = attestationShortfalls([{ requiredAttestations: 2 }], 0);
    expect(out[0]).toMatch(/No attestors are registered/);
  });
});

describe("maxOpenRequirement", () => {
  it("is 0 with no live campaign and the highest open requirement otherwise", async () => {
    expect(maxOpenRequirement(db)).toBe(0);
    await makeLiveCampaign(db);
    expect(maxOpenRequirement(db)).toBe(2);
  });
});
