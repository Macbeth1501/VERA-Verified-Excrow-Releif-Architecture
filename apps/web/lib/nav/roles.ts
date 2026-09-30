import type { Role } from "../auth/session";

export interface NavLink {
  href: string;
  label: string;
}

export interface NavIdentity {
  id: string;
  email: string;
  role: Role;
}

const ROLE_LABEL: Record<Role, string> = {
  donor: "Donor",
  organizer: "Organizer",
  attestor: "Attestor",
  council: "Council member",
  admin: "Admin",
};

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role];
}

/** Where /dashboard sends each role: the page that is their main workspace. */
export function roleHome(role: Role): string {
  switch (role) {
    case "admin":
      return "/dashboard/admin";
    case "attestor":
      return "/dashboard/attestor";
    case "council":
      return "/dashboard/council";
    case "organizer":
      return "/dashboard/campaigns";
    default:
      return "/dashboard/donor";
  }
}

/** The navigation links a signed-in user sees. Pages still enforce the role themselves; this is only convenience. */
export function navLinksFor(role: Role): NavLink[] {
  const links: NavLink[] = [{ href: "/campaigns", label: "Campaigns" }, { href: "/dashboard", label: "My dashboard" }];
  switch (role) {
    case "admin":
      links.push({ href: "/dashboard/admin", label: "Admin console" });
      break;
    case "attestor":
      links.push({ href: "/dashboard/attestor", label: "Attestor console" });
      break;
    case "council":
      links.push({ href: "/dashboard/council", label: "Council console" });
      break;
    case "organizer":
      links.push({ href: "/dashboard/campaigns", label: "My campaigns" }, { href: "/dashboard/organizer", label: "Organizer status" });
      break;
    default:
      links.push({ href: "/dashboard/organizer", label: "Become an organizer" });
  }
  links.push({ href: "/dashboard/donor", label: "Account" });
  return links;
}

export type IdentityChange =
  | { kind: "same" }
  | { kind: "signed-out" }
  | { kind: "switched"; to: NavIdentity };

/**
 * Compares who this tab was showing with who the shared session cookie says is signed in now.
 * Every tab in a browser profile shares one cookie, so signing in as someone else in another tab
 * changes this tab's identity on its next request. A role change for the same account counts too,
 * since an approved organizer or a new attestor sees different pages.
 */
export function identityChange(baseline: NavIdentity | null, current: NavIdentity | null): IdentityChange {
  if (baseline === null && current === null) return { kind: "same" };
  if (baseline === null) return { kind: "switched", to: current as NavIdentity };
  if (current === null) return { kind: "signed-out" };
  if (baseline.id !== current.id || baseline.role !== current.role) return { kind: "switched", to: current };
  return { kind: "same" };
}
