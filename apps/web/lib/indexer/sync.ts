import type { Db } from "../db";
import { getCursor, insertEvents, knownVaults, setCursor } from "./store";
import type { ChainReader, IndexerConfig, RawEvent } from "./types";

export interface SyncResult {
  headBlock: number | null;
  /** Highest block eligible for indexing (head minus confirmations). */
  safeBlock: number | null;
  newEvents: number;
  errors: string[];
}

type Fetch = (from: number, to: number) => Promise<RawEvent[]>;

function message(err: unknown): string {
  return err instanceof Error ? err.message.split("\n")[0].slice(0, 160) : "unknown error";
}

/**
 * Reads one stream from just after its cursor up to `safeBlock`, in chunks. If a chunk fails
 * (typically an RPC refusing a large range) the chunk is halved and retried; a chunk only counts,
 * and the cursor only advances, once its events are stored. Returns the number of new events.
 */
async function syncStream(
  db: Db,
  reader: ChainReader,
  stream: string,
  initialCursor: number,
  safeBlock: number,
  maxRange: number,
  fetchEvents: Fetch,
  errors: string[],
): Promise<number> {
  let from = (getCursor(db, stream) ?? initialCursor) + 1;
  let size = maxRange;
  let added = 0;

  while (from <= safeBlock) {
    const to = Math.min(from + size - 1, safeBlock);
    try {
      const events = await fetchEvents(from, to);
      const blocks = [...new Set(events.map((e) => e.blockNumber))];
      const timestamps = blocks.length ? await reader.blockTimestamps(blocks) : new Map<number, string>();
      added += insertEvents(db, events, timestamps);
      setCursor(db, stream, to);
      from = to + 1;
      size = Math.min(maxRange, size * 2);
    } catch (err) {
      if (size > 1) {
        size = Math.max(1, Math.floor(size / 2));
        continue;
      }
      errors.push(`${stream} at block ${from}: ${message(err)}`);
      break;
    }
  }
  return added;
}

/**
 * One full pass: the factory first (to discover vaults), then every known vault. Never throws;
 * problems are returned in `errors` and the next pass resumes from the saved cursors.
 */
export async function syncOnce(db: Db, reader: ChainReader, config: IndexerConfig): Promise<SyncResult> {
  const errors: string[] = [];
  let headBlock: number;
  try {
    headBlock = await reader.headBlock();
  } catch (err) {
    return { headBlock: null, safeBlock: null, newEvents: 0, errors: [`could not read chain head: ${message(err)}`] };
  }

  const safeBlock = headBlock - config.confirmations;
  let newEvents = 0;

  newEvents += await syncStream(
    db, reader, "factory", config.startBlock - 1, safeBlock, config.maxRange,
    (from, to) => reader.factoryEvents(from, to), errors,
  );

  if (config.managerStartBlock !== undefined && reader.managerEvents) {
    const managerEvents = reader.managerEvents.bind(reader);
    newEvents += await syncStream(
      db, reader, "manager", config.managerStartBlock - 1, safeBlock, config.maxRange,
      (from, to) => managerEvents(from, to), errors,
    );
  }

  if (config.registryStartBlock !== undefined && reader.registryEvents) {
    const registryEvents = reader.registryEvents.bind(reader);
    newEvents += await syncStream(
      db, reader, "registry", config.registryStartBlock - 1, safeBlock, config.maxRange,
      (from, to) => registryEvents(from, to), errors,
    );
  }

  for (const { vault, createdAtBlock } of knownVaults(db)) {
    newEvents += await syncStream(
      db, reader, `vault:${vault}`, createdAtBlock - 1, safeBlock, config.maxRange,
      (from, to) => reader.vaultEvents(vault, from, to), errors,
    );
  }

  return { headBlock, safeBlock, newEvents, errors };
}
