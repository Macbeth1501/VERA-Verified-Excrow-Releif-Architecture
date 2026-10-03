import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db";
import { resetSyncState, syncWithinBudget, type IndexerRuntime } from "./runtime";
import type { ChainReader } from "./types";

let db: Db;
beforeEach(() => {
  db = createDb(":memory:");
  resetSyncState();
});

const runtimeWith = (reader: Partial<ChainReader>): IndexerRuntime =>
  ({ reader: reader as ChainReader, config: { startBlock: 1, confirmations: 2, maxRange: 2000 } }) as IndexerRuntime;

describe("syncWithinBudget", () => {
  it("returns after the budget when the chain is slow, instead of hanging the page", async () => {
    const slow = runtimeWith({ headBlock: () => new Promise<number>(() => {}) });
    const started = Date.now();
    await syncWithinBudget(db, slow, 50);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("swallows a failing chain read and still returns", async () => {
    const broken = runtimeWith({ headBlock: () => Promise.reject(new Error("rpc down")) });
    await expect(syncWithinBudget(db, broken, 500)).resolves.toBeUndefined();
  });
});
