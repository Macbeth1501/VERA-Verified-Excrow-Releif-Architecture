import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { resetEnvCache } from "@/lib/env";
import { getDb, resetDbForTests, schema } from "@/lib/db";
import { registerDonor } from "@/lib/auth/users";
import { signSession } from "@/lib/auth/session";
import { GET as session } from "./route";

const ENC_KEY = "ab".repeat(32);

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = ENC_KEY;
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  resetEnvCache();
  resetDbForTests();
});

const get = (cookie?: string) =>
  session(new Request("http://localhost/api/v1/auth/session", { headers: cookie ? { cookie } : {} }));

describe("GET /api/v1/auth/session", () => {
  it("reports signed out as a plain 200 with no user", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("reports a tampered cookie as signed out", async () => {
    expect(await (await get("vera_session=not-a-real-token")).json()).toEqual({ user: null });
  });

  it("returns only id, email and role, never the wallet", async () => {
    const u = await registerDonor(getDb(), { email: "d@example.com", password: "correct-horse-battery" }, ENC_KEY);
    const token = await signSession({ userId: u.id, role: "donor" });
    const body = await (await get(`vera_session=${token}`)).json();
    expect(body).toEqual({ user: { id: u.id, email: "d@example.com", role: "donor" } });
  });

  it("takes the role from the database, not from the token", async () => {
    const db = getDb();
    const u = await registerDonor(db, { email: "p@example.com", password: "correct-horse-battery" }, ENC_KEY);
    const token = await signSession({ userId: u.id, role: "donor" });
    db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, u.id)).run();
    expect((await (await get(`vera_session=${token}`)).json()).user.role).toBe("admin");
  });
});
