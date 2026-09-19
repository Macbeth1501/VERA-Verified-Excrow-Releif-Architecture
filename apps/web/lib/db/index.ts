import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { getEnv } from "../env";

export type Db = BetterSQLite3Database<typeof schema>;

/**
 * Opens (creating if needed) a SQLite database and applies forward-only migrations from
 * `apps/web/drizzle`. Ref: SPDD §11.6.
 */
export function createDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

// Cached on globalThis so Next.js dev hot-reloads do not open a new connection each time.
const globalForDb = globalThis as unknown as { __veraDb?: Db };

export function getDb(): Db {
  if (!globalForDb.__veraDb) globalForDb.__veraDb = createDb(getEnv().DATABASE_URL);
  return globalForDb.__veraDb;
}

/** Test hook. */
export function resetDbForTests(): void {
  globalForDb.__veraDb = undefined;
}

export { schema };
