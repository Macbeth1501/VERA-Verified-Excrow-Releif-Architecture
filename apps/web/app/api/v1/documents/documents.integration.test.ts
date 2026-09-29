import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { getDb, resetDbForTests, schema } from "@/lib/db";
import { registerDonor } from "@/lib/auth/users";
import { signSession, type Role } from "@/lib/auth/session";
import { saveDocument } from "@/lib/files/service";

import { GET } from "./[id]/route";

const ENC_KEY = "ab".repeat(32);
let counter = 0;

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.WALLET_ENCRYPTION_KEY = ENC_KEY;
  process.env.MOCK_INR_ADDRESS = "0x9b6f00a1ce627a3e0d2da601253704084d8fc52c";
  resetEnvCache();
  resetDbForTests();
});

async function makeUser(role: Role) {
  const user = await registerDonor(getDb(), { email: `doc${++counter}@example.com`, password: "correct-horse-battery" }, ENC_KEY);
  if (role !== "donor") getDb().update(schema.users).set({ role }).where(eq(schema.users.id, user.id)).run();
  return { id: user.id, cookie: `vera_session=${await signSession({ userId: user.id, role })}` };
}

function req(cookie?: string) {
  return new Request("http://localhost/x", { headers: cookie ? { cookie } : {} });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function makeDoc(purpose: "kyb" | "milestone_evidence") {
  const uploader = await makeUser("donor");
  const bytes = Buffer.from("document bytes");
  const hash = createHash("sha256").update(bytes).digest("hex");
  return saveDocument(getDb(), {
    purpose,
    filename: "file.pdf",
    mimeType: "application/pdf",
    base64Data: bytes.toString("base64"),
    expectedHash: hash,
    uploadedByUserId: uploader.id,
  });
}

describe("GET /api/v1/documents/:id", () => {
  it("404s for an unknown id", async () => {
    const admin = await makeUser("admin");
    const res = await GET(req(admin.cookie), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("401s when signed out", async () => {
    const id = await makeDoc("kyb");
    const res = await GET(req(), ctx(id));
    expect(res.status).toBe(401);
  });

  it("lets an admin open a KYB document", async () => {
    const id = await makeDoc("kyb");
    const admin = await makeUser("admin");
    const res = await GET(req(admin.cookie), ctx(id));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("document bytes");
  });

  it("refuses a donor, organizer, attestor and council member a KYB document", async () => {
    const id = await makeDoc("kyb");
    for (const role of ["donor", "organizer", "attestor", "council"] as const) {
      const user = await makeUser(role);
      const res = await GET(req(user.cookie), ctx(id));
      expect(res.status).toBe(403);
    }
  });

  it("lets admin, attestor and council open milestone evidence, but not a donor", async () => {
    const id = await makeDoc("milestone_evidence");
    for (const role of ["admin", "attestor", "council"] as const) {
      const user = await makeUser(role);
      const res = await GET(req(user.cookie), ctx(id));
      expect(res.status).toBe(200);
    }
    const donor = await makeUser("donor");
    const res = await GET(req(donor.cookie), ctx(id));
    expect(res.status).toBe(403);
  });
});
