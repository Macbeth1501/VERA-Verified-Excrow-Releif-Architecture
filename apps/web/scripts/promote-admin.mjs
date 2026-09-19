// Usage: pnpm --filter ./apps/web admin:promote you@example.com
// Promotes an existing account to the admin role. This is the only way to create an admin:
// there is deliberately no web route that can grant it. Run it on the machine that holds the
// database. Add "--demote" to return the account to a donor.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const args = process.argv.slice(2);
const demote = args.includes("--demote");
const email = args.find((a) => !a.startsWith("--"));
if (!email) {
  console.error("Usage: admin:promote <email> [--demote]");
  process.exit(1);
}

function envValue(name) {
  if (process.env[name]) return process.env[name];
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim();
}

const dbFile = path.resolve(process.cwd(), envValue("DATABASE_URL") ?? "./data/vera.db");
if (!existsSync(dbFile)) {
  console.error(`Database not found at ${dbFile}. Start the app and register the account first.`);
  process.exit(1);
}

const emailHash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
const db = new Database(dbFile);
const user = db.prepare("select id, email, role from users where email_hash = ?").get(emailHash);
if (!user) {
  console.error(`No account found for ${email}. Register it in the app first.`);
  process.exit(1);
}

const role = demote ? "donor" : "admin";
db.prepare("update users set role = ? where id = ?").run(role, user.id);
console.log(`${user.email}: ${user.role} -> ${role}`);
