/** Drizzle Kit settings: SQLite dialect, schema in `lib/db/schema.ts`, generated migrations in `./drizzle`. */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
});
