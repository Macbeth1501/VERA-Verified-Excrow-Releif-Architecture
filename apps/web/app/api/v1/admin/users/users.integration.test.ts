/** Integration tests for GET /api/v1/admin/users: admin-only access, filters, validation, and no credentials in the response. */

import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { resetEnvCache } from "@/lib/env";
import { getDb, resetDbForTests, schema } from "@/lib/db";
import { registerDonor } from "@/lib/auth/users";
import { signSession, type Role } from "@/lib/auth/session";
import { GET } from "./route";

const ENC_KEY = "ab".repeat(32);
let counter = 0;

async function account(role: Role, email = `u${++counter}@example.com`) {
  const user = await registerDonor(getDb(), { email, password: "correct-horse-battery" }, ENC_KEY);
  if (role !== "donor") getDb().update(schema.users).set({ role }).where(eq(schema.users.id, user.id)).run();
  return { user, cookie: `vera_session=${await signSession({ userId: user.id, role })}` };
}
const get = (query = "", cookie?: string) =>
  GET(new Request(`http://localhost/api/v1/admin/users${query}`, { headers: cookie ? { cookie } : {} }));

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = ENC_KEY;
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  resetEnvCache();
  resetDbForTests();
});

describe("access", () => {
  it("signed-out gets 401 and every non-admin role gets 403, so no email leaks", async () => {
    await account("donor", "victim@example.com");
    expect((await get()).status).toBe(401);
    for (const role of ["donor", "organizer", "attestor", "council"] as const) {
      const { cookie } = await account(role);
      const res = await get("", cookie);
      expect(res.status, role).toBe(403);
      expect(JSON.stringify(await res.json())).not.toContain("victim@example.com");
    }
  });

  it("reads the role from the database, not the session, so a demoted admin is refused at once", async () => {
    const { user, cookie } = await account("admin");
    expect((await get("", cookie)).status).toBe(200);
    getDb().update(schema.users).set({ role: "donor" }).where(eq(schema.users.id, user.id)).run();
    expect((await get("", cookie)).status).toBe(403);
  });
});

describe("response", () => {
  it("lists accounts with their emails and role counts, and never any credential", async () => {
    const admin = await account("admin", "admin@example.com");
    await account("donor", "donor@example.com");
    await account("attestor", "att@example.com");
    const res = await get("", admin.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.users.map((u: { email: string }) => u.email).sort()).toEqual(["admin@example.com", "att@example.com", "donor@example.com"]);
    expect(body.countsByRole).toEqual({ donor: 1, organizer: 0, attestor: 1, council: 0, admin: 1 });
    const text = JSON.stringify(body);
    for (const field of ["passwordHash", "password_hash", "emailHash", "email_hash", "walletKeyEnc", "wallet_key_enc"]) {
      expect(text, field).not.toContain(field);
    }
    const row = getDb().select().from(schema.users).where(eq(schema.users.email, "donor@example.com")).get()!;
    expect(text).not.toContain(row.passwordHash);
    expect(text).not.toContain(row.walletKeyEnc!);
  });

  it("filters by search text and role, and pages", async () => {
    const admin = await account("admin", "admin@example.com");
    await account("donor", "alpha@example.com");
    await account("donor", "beta@example.com");
    await account("council", "gamma@example.com");
    expect((await (await get("?q=alp", admin.cookie)).json()).users.map((u: { email: string }) => u.email)).toEqual(["alpha@example.com"]);
    expect((await (await get("?role=council", admin.cookie)).json()).total).toBe(1);
    const paged = await (await get("?limit=2&offset=0", admin.cookie)).json();
    expect([paged.users.length, paged.total, paged.limit]).toEqual([2, 4, 2]);
  });

  it("rejects an unknown role and non-numeric paging with 400", async () => {
    const admin = await account("admin");
    expect((await get("?role=root", admin.cookie)).status).toBe(400);
    expect((await get("?limit=abc", admin.cookie)).status).toBe(400);
    expect((await get("?offset=x", admin.cookie)).status).toBe(400);
  });
});
