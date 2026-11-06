import { asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db";
import { chainEvents, indexerCursors, type ChainEventRow } from "../db/schema";
import type { RawEvent } from "./types";

/**
 * All writes to money-related data happen in this file and in sync.ts. Nothing else in the app
 * may insert into chain_events (SPDD 11.1: fund figures are read-only projections).
 */

/** The last block fully read for a stream, or null if the stream has never been read. */
export function getCursor(db: Db, stream: string): number | null {
  const row = db.select().from(indexerCursors).where(eq(indexerCursors.stream, stream)).get();
  return row ? row.lastBlock : null;
}

/** Records the last block read for a stream, creating or updating its cursor. */
export function setCursor(db: Db, stream: string, lastBlock: number): void {
  const updatedAt = new Date().toISOString();
  db.insert(indexerCursors)
    .values({ stream, lastBlock, updatedAt })
    .onConflictDoUpdate({ target: indexerCursors.stream, set: { lastBlock, updatedAt } })
    .run();
}

/** Every stream's cursor with its last update time. */
export function allCursors(db: Db): Array<{ stream: string; lastBlock: number; updatedAt: string }> {
  return db.select().from(indexerCursors).all();
}

/** Inserts events, ignoring any already stored (same txHash:logIndex). Returns how many were new. */
export function insertEvents(db: Db, events: RawEvent[], timestamps: Map<number, string>): number {
  let inserted = 0;
  db.transaction((tx) => {
    for (const e of events) {
      const result = tx
        .insert(chainEvents)
        .values({
          id: `${e.txHash}:${e.logIndex}`,
          eventName: e.name,
          contractAddress: e.contract.toLowerCase(),
          vaultAddress: e.vault.toLowerCase(),
          blockNumber: e.blockNumber,
          blockTimestamp: timestamps.get(e.blockNumber) ?? new Date(0).toISOString(),
          txHash: e.txHash,
          logIndex: e.logIndex,
          args: JSON.stringify(e.args),
        })
        .onConflictDoNothing()
        .run();
      inserted += result.changes;
    }
  });
  return inserted;
}

/** A vault's indexed events in chain order (block, then log index). */
export function eventsForVault(db: Db, vault: string): ChainEventRow[] {
  return db
    .select()
    .from(chainEvents)
    .where(eq(chainEvents.vaultAddress, vault.toLowerCase()))
    .orderBy(asc(chainEvents.blockNumber), asc(chainEvents.logIndex))
    .all();
}

/** Every vault the factory has announced, with the block it was created in. */
export function knownVaults(db: Db): Array<{ vault: string; createdAtBlock: number }> {
  return db
    .select()
    .from(chainEvents)
    .where(eq(chainEvents.eventName, "CampaignCreated"))
    .orderBy(asc(chainEvents.blockNumber))
    .all()
    .map((r) => ({ vault: r.vaultAddress, createdAtBlock: r.blockNumber }));
}

/** Indexed events for several vaults at once (addresses compared lower-cased); empty input returns no rows. */
export function eventsForVaults(db: Db, vaults: string[]): ChainEventRow[] {
  if (vaults.length === 0) return [];
  return db
    .select()
    .from(chainEvents)
    .where(inArray(chainEvents.vaultAddress, vaults.map((v) => v.toLowerCase())))
    .all();
}
