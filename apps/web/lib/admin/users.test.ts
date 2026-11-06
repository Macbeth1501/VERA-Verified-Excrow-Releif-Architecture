import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db";
import { organizerProfiles, users } from "../db/schema";
import { makeDonor, makeLiveCampaign } from "../donations/test-setup";
import { listUsers, parseRole, USER_ROLES } from "./users";

let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
});

async function account(email: string, role: "donor" | "attestor" | "council" = "donor", createdAt?: string) {
  const u = await makeDonor(db);
  db.update(users)
    .set({ email, ...(role !== "donor" ? { role } : {}), ...(createdAt ? { createdAt } : {}) })
    .where(eq(users.id, u.id))
    .run();
  return u;
}

describe("listUsers", () => {
  it("is empty with zero counts when nobody registered", () => {
    const page = listUsers(db);
    expect(page.users).toEqual([]);
    expect(page.total).toBe(0);
    expect(page.countsByRole).toEqual({ donor: 0, organizer: 0, attestor: 0, council: 0, admin: 0 });
  });

  it("lists every account with its email, newest first", async () => {
    await account("old@example.com", "donor", "2026-01-01T00:00:00.000Z");
    await account("newest@example.com", "donor", "2026-03-01T00:00:00.000Z");
    await account("middle@example.com", "attestor", "2026-02-01T00:00:00.000Z");
    const page = listUsers(db);
    expect(page.users.map((u) => u.email)).toEqual(["newest@example.com", "middle@example.com", "old@example.com"]);
    expect(page.total).toBe(3);
  });

  it("never returns a password hash, an email hash or wallet key material", async () => {
    await account("someone@example.com");
    const u = listUsers(db).users[0];
    expect(Object.keys(u).sort()).toEqual(["createdAt", "email", "id", "organizerStatus", "role", "walletAddress", "walletType"]);
    const dump = JSON.stringify(listUsers(db));
    const row = db.select().from(users).where(eq(users.email, "someone@example.com")).get()!;
    expect(dump).not.toContain(row.passwordHash);
    expect(dump).not.toContain(row.emailHash);
    expect(row.walletKeyEnc).toBeTruthy();
    expect(dump).not.toContain(row.walletKeyEnc!);
  });

  it("filters by role and counts each role regardless of the filter", async () => {
    await account("a@example.com");
    await account("b@example.com", "attestor");
    await account("c@example.com", "council");
    await account("d@example.com", "council");
    const councils = listUsers(db, { role: "council" });
    expect(councils.users.map((u) => u.role)).toEqual(["council", "council"]);
    expect(councils.total).toBe(2);
    expect(councils.countsByRole).toMatchObject({ donor: 1, attestor: 1, council: 2 });
  });

  it("finds part of an email, ignoring case, and treats % and _ as plain characters", async () => {
    await account("Asha.Devi@Example.com");
    await account("ravi_kumar@example.com");
    await account("other@example.com");
    expect(listUsers(db, { q: "ASHA" }).users.map((u) => u.email)).toEqual(["Asha.Devi@Example.com"]);
    expect(listUsers(db, { q: "example.com" }).total).toBe(3);
    expect(listUsers(db, { q: "_" }).users.map((u) => u.email)).toEqual(["ravi_kumar@example.com"]);
    expect(listUsers(db, { q: "%" }).total).toBe(0);
    expect(listUsers(db, { q: "nobody" }).total).toBe(0);
  });

  it("combines the search and the role filter", async () => {
    await account("x@example.com", "attestor");
    await account("y@example.com", "council");
    expect(listUsers(db, { q: "example", role: "attestor" }).users.map((u) => u.email)).toEqual(["x@example.com"]);
  });

  it("pages and clamps the limit and offset", async () => {
    for (let i = 0; i < 5; i++) await account(`user${i}@example.com`, "donor", `2026-01-0${i + 1}T00:00:00.000Z`);
    const first = listUsers(db, { limit: 2, offset: 0 });
    const second = listUsers(db, { limit: 2, offset: 2 });
    expect(first.users.map((u) => u.email)).toEqual(["user4@example.com", "user3@example.com"]);
    expect(second.users.map((u) => u.email)).toEqual(["user2@example.com", "user1@example.com"]);
    expect(first.total).toBe(5);
    expect(listUsers(db, { limit: 0 }).limit).toBe(50); // a nonsense limit falls back to the default
    expect(listUsers(db, { limit: 9999 }).limit).toBe(200);
    expect(listUsers(db, { offset: -5 }).offset).toBe(0);
  });

  it("shows the organizer application status, or null for someone who never applied", async () => {
    await makeLiveCampaign(db); // creates an approved organizer and an admin
    const org = db.select().from(organizerProfiles).get()!;
    const orgUser = db.select().from(users).where(eq(users.id, org.userId)).get()!;
    const page = listUsers(db);
    expect(page.users.find((u) => u.id === orgUser.id)?.organizerStatus).toBe(org.kybStatus);
    expect(page.users.filter((u) => u.organizerStatus === null).length).toBe(page.total - 1);
    expect(page.countsByRole.organizer).toBe(1);
    expect(page.countsByRole.admin).toBe(1);
  });
});

describe("parseRole", () => {
  it("accepts a real role and nothing else", () => {
    for (const r of USER_ROLES) expect(parseRole(r)).toBe(r);
    for (const bad of ["", "root", "ADMIN", null, undefined, "donor "]) expect(parseRole(bad)).toBeUndefined();
  });
});
