import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { privateKeyToAccount } from "viem/accounts";
import { resetEnvCache } from "@/lib/env";
import { getDb, resetDbForTests, schema } from "@/lib/db";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { decryptSecret } from "@/lib/auth/crypto";

const balanceMock = vi.hoisted(() => ({ getMinrBalance: vi.fn() }));
vi.mock("@/lib/chain/balance", async (orig) => ({
  ...(await orig<typeof import("@/lib/chain/balance")>()),
  getMinrBalance: balanceMock.getMinrBalance,
}));

import { POST as register } from "./register/route";
import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { GET as me } from "./me/route";

const ENC_KEY = "ab".repeat(32);
const PASSWORD = "correct-horse-battery";

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function cookieFrom(res: Response): string {
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

function userRow(id: string) {
  const row = getDb().select().from(schema.users).where(eq(schema.users.id, id)).get();
  if (!row) throw new Error("user row not found");
  return row;
}

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = ENC_KEY;
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  resetEnvCache();
  resetDbForTests();
  resetRateLimits();
  balanceMock.getMinrBalance.mockReset();
  balanceMock.getMinrBalance.mockResolvedValue(0n);
});

describe("POST /api/v1/auth/register", () => {
  it("creates a donor with a generated wallet and signs them in", async () => {
    const res = await register(post("/api/v1/auth/register", { email: "Donor@Example.com", password: PASSWORD }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.wallet_address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(body.user.email).toBe("donor@example.com");
    expect(body.user.walletType).toBe("generated");
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(JSON.stringify(body)).not.toMatch(/password|walletKey|privateKey/i);
  });

  it("stores the password hashed and the wallet key encrypted, and the key matches the address", async () => {
    const res = await register(post("/api/v1/auth/register", { email: "d@example.com", password: PASSWORD }));
    const { user_id, wallet_address } = await res.json();
    const row = userRow(user_id);
    expect(row.passwordHash).not.toContain(PASSWORD);
    expect(row.walletKeyEnc).not.toBeNull();
    const key = decryptSecret(String(row.walletKeyEnc), ENC_KEY) as `0x${string}`;
    expect(privateKeyToAccount(key).address).toBe(wallet_address);
  });

  it("rejects a duplicate email, including different letter case", async () => {
    await register(post("/api/v1/auth/register", { email: "dup@example.com", password: PASSWORD }));
    const res = await register(post("/api/v1/auth/register", { email: "DUP@example.com", password: PASSWORD }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("accepts an existing wallet address and stores no key for it", async () => {
    const own = "0xb2Ab1471d98909237B3F3828E7422182584E11E3";
    const res = await register(
      post("/api/v1/auth/register", { email: "own@example.com", password: PASSWORD, walletAddress: own }),
    );
    expect(res.status).toBe(201);
    const { user_id, user } = await res.json();
    expect(user.walletType).toBe("external");
    expect(user.walletAddress).toBe(own);
    expect(userRow(user_id).walletKeyEnc).toBeNull();
  });

  it("returns specific validation errors", async () => {
    const short = await register(post("/api/v1/auth/register", { email: "a@example.com", password: "short" }));
    expect(short.status).toBe(400);
    const body = await short.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details.password).toBeDefined();

    const badEmail = await register(post("/api/v1/auth/register", { email: "nope", password: PASSWORD }));
    expect((await badEmail.json()).error.details.email).toBeDefined();
  });

  it("rejects invalid JSON", async () => {
    const res = await register(post("/api/v1/auth/register", "{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_JSON");
  });

  it("rate limits repeated attempts from one client", async () => {
    let last = 0;
    for (let i = 0; i < 7; i++) {
      const res = await register(post("/api/v1/auth/register", { email: "x", password: "y" }, { "x-forwarded-for": "9.9.9.9" }));
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

describe("login, session and balance", () => {
  async function signUp(email = "u@example.com") {
    const res = await register(post("/api/v1/auth/register", { email, password: PASSWORD }));
    return res.json();
  }

  it("logs in with the right password and treats a wrong password like an unknown email", async () => {
    await signUp();
    const ok = await login(post("/api/v1/auth/login", { email: "U@example.com", password: PASSWORD }));
    expect(ok.status).toBe(200);

    const wrong = await login(post("/api/v1/auth/login", { email: "u@example.com", password: "wrong-password-1" }));
    const unknown = await login(post("/api/v1/auth/login", { email: "ghost@example.com", password: "wrong-password-1" }));
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it("shows a zero mINR balance for a new donor right after registering (FR-IDN-01)", async () => {
    const res = await register(post("/api/v1/auth/register", { email: "new@example.com", password: PASSWORD }));
    const { wallet_address } = await res.json();
    const info = await me(new Request("http://localhost/api/v1/auth/me", { headers: { cookie: cookieFrom(res) } }));
    expect(info.status).toBe(200);
    const body = await info.json();
    expect(body.balance_minor_units).toBe("0");
    expect(body.balance_error).toBeNull();
    expect(balanceMock.getMinrBalance).toHaveBeenCalledWith(wallet_address);
  });

  it("reports balance as unavailable, never as zero, when the chain read fails", async () => {
    balanceMock.getMinrBalance.mockRejectedValue(new Error("rpc down"));
    const res = await register(post("/api/v1/auth/register", { email: "n@example.com", password: PASSWORD }));
    const info = await me(new Request("http://localhost/api/v1/auth/me", { headers: { cookie: cookieFrom(res) } }));
    const body = await info.json();
    expect(body.balance_minor_units).toBeNull();
    expect(body.balance_error).toBe("BALANCE_UNAVAILABLE");
  });

  it("requires a valid session for /me", async () => {
    expect((await me(new Request("http://localhost/api/v1/auth/me"))).status).toBe(401);
    const forged = await me(
      new Request("http://localhost/api/v1/auth/me", { headers: { cookie: "vera_session=abc.def.ghi" } }),
    );
    expect(forged.status).toBe(401);
  });

  it("logout clears the cookie", async () => {
    const res = await logout();
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });
});
