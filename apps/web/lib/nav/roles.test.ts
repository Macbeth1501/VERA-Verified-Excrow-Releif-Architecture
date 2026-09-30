import { describe, expect, it } from "vitest";
import { identityChange, navLinksFor, roleHome, roleLabel, type NavIdentity } from "./roles";

const donor: NavIdentity = { id: "u1", email: "d@example.com", role: "donor" };
const admin: NavIdentity = { id: "u2", email: "a@example.com", role: "admin" };

describe("roleHome", () => {
  it("sends every role to its own workspace", () => {
    expect(roleHome("admin")).toBe("/dashboard/admin");
    expect(roleHome("attestor")).toBe("/dashboard/attestor");
    expect(roleHome("council")).toBe("/dashboard/council");
    expect(roleHome("organizer")).toBe("/dashboard/campaigns");
    expect(roleHome("donor")).toBe("/dashboard/donor");
  });
});

describe("navLinksFor", () => {
  it("gives each role its own console and never another role's", () => {
    const hrefs = (r: Parameters<typeof navLinksFor>[0]) => navLinksFor(r).map((l) => l.href);
    expect(hrefs("admin")).toContain("/dashboard/admin");
    expect(hrefs("admin")).not.toContain("/dashboard/attestor");
    expect(hrefs("attestor")).toContain("/dashboard/attestor");
    expect(hrefs("attestor")).not.toContain("/dashboard/admin");
    expect(hrefs("council")).toContain("/dashboard/council");
    expect(hrefs("organizer")).toContain("/dashboard/campaigns");
    expect(hrefs("donor")).toContain("/dashboard/organizer");
    expect(hrefs("donor")).not.toContain("/dashboard/campaigns");
  });

  it("always offers campaigns, chain activity, the dashboard and the account", () => {
    for (const role of ["donor", "organizer", "attestor", "council", "admin"] as const) {
      const hrefs = navLinksFor(role).map((l) => l.href);
      expect(hrefs).toEqual(expect.arrayContaining(["/campaigns", "/activity", "/dashboard", "/dashboard/donor"]));
    }
  });

  it("has a readable label for every role", () => {
    expect(roleLabel("council")).toBe("Council member");
  });
});

describe("identityChange", () => {
  it("is unchanged for the same account and role", () => {
    expect(identityChange(donor, { ...donor })).toEqual({ kind: "same" });
    expect(identityChange(null, null)).toEqual({ kind: "same" });
  });

  it("detects signing in as someone else in another window", () => {
    expect(identityChange(donor, admin)).toEqual({ kind: "switched", to: admin });
  });

  it("detects a role change on the same account", () => {
    expect(identityChange(donor, { ...donor, role: "organizer" })).toEqual({ kind: "switched", to: { ...donor, role: "organizer" } });
  });

  it("detects being signed out elsewhere and signing in after being anonymous", () => {
    expect(identityChange(donor, null)).toEqual({ kind: "signed-out" });
    expect(identityChange(null, admin)).toEqual({ kind: "switched", to: admin });
  });
});
