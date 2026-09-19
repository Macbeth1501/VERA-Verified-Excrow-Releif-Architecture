import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db";
import { organizerProfiles, users, type OrganizerProfileRow } from "../db/schema";
import type { ChainSyncResult } from "../chain/factory";
import type { ApplicationInput } from "./validation";

export type KybStatus = OrganizerProfileRow["kybStatus"];

/** Shape returned to the applicant and admins. */
export interface OrganizerProfile {
  id: string;
  userId: string;
  legalName: string;
  registrationNumber: string;
  jurisdiction: string;
  documentName: string;
  documentHash: string;
  kybStatus: KybStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  chainSync: OrganizerProfileRow["chainSync"];
  chainTxHash: string | null;
  chainError: string | null;
  createdAt: string;
}

/** Shape returned publicly: registration details only, and only for verified organizers. */
export interface PublicOrganizerProfile {
  id: string;
  legalName: string;
  registrationNumber: string;
  jurisdiction: string;
  verifiedAt: string | null;
}

export class AlreadyAppliedError extends Error {
  constructor(public status: KybStatus) {
    super(status === "verified" ? "You are already a verified organizer" : "Your application is already under review");
  }
}
export class ProfileNotFoundError extends Error {
  constructor() {
    super("Organizer application not found");
  }
}
export class OrganizerNotVerifiedError extends Error {
  constructor(public status: KybStatus | "none") {
    super("Only verified organizers can do this");
  }
}
export class AlreadyReviewedError extends Error {
  constructor(public status: KybStatus) {
    super(`This application was already ${status}`);
  }
}

function toProfile(row: OrganizerProfileRow): OrganizerProfile {
  return {
    id: row.id,
    userId: row.userId,
    legalName: row.legalName,
    registrationNumber: row.registrationNumber,
    jurisdiction: row.jurisdiction,
    documentName: row.documentName,
    documentHash: row.documentHash,
    kybStatus: row.kybStatus,
    rejectionReason: row.rejectionReason,
    reviewedAt: row.reviewedAt,
    chainSync: row.chainSync,
    chainTxHash: row.chainTxHash,
    chainError: row.chainError,
    createdAt: row.createdAt,
  };
}

export function getProfileByUser(db: Db, userId: string): OrganizerProfile | null {
  const row = db.select().from(organizerProfiles).where(eq(organizerProfiles.userId, userId)).get();
  return row ? toProfile(row) : null;
}

/**
 * Submits (or, after a rejection, resubmits) an application. Status always starts as pending;
 * a pending or verified applicant cannot apply again.
 */
export function submitApplication(db: Db, userId: string, input: ApplicationInput): OrganizerProfile {
  const existing = db.select().from(organizerProfiles).where(eq(organizerProfiles.userId, userId)).get();
  if (existing && existing.kybStatus !== "rejected") throw new AlreadyAppliedError(existing.kybStatus);

  const fields = {
    legalName: input.legalName,
    registrationNumber: input.registrationNumber,
    jurisdiction: input.jurisdiction,
    documentHash: input.documentHash.toLowerCase(),
    documentName: input.documentName,
    kybStatus: "pending" as const,
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: null,
    chainSync: "none" as const,
    chainTxHash: null,
    chainError: null,
  };

  if (existing) {
    db.update(organizerProfiles).set(fields).where(eq(organizerProfiles.id, existing.id)).run();
  } else {
    db.insert(organizerProfiles).values({ id: randomUUID(), userId, ...fields }).run();
  }
  const saved = getProfileByUser(db, userId);
  if (!saved) throw new Error("Profile missing after save");
  return saved;
}

export type AdminProfileView = OrganizerProfile & { email: string; walletAddress: string };

export function listProfiles(db: Db, status?: KybStatus): AdminProfileView[] {
  const rows = db
    .select({ profile: organizerProfiles, email: users.email, walletAddress: users.walletAddress })
    .from(organizerProfiles)
    .innerJoin(users, eq(users.id, organizerProfiles.userId))
    .where(status ? eq(organizerProfiles.kybStatus, status) : undefined)
    .orderBy(desc(organizerProfiles.createdAt))
    .all();
  return rows.map((r) => ({ ...toProfile(r.profile), email: r.email, walletAddress: r.walletAddress }));
}

export function getProfileById(db: Db, profileId: string): AdminProfileView | null {
  const row = db
    .select({ profile: organizerProfiles, email: users.email, walletAddress: users.walletAddress })
    .from(organizerProfiles)
    .innerJoin(users, eq(users.id, organizerProfiles.userId))
    .where(eq(organizerProfiles.id, profileId))
    .get();
  return row ? { ...toProfile(row.profile), email: row.email, walletAddress: row.walletAddress } : null;
}

/**
 * Records an admin decision on a pending application. Approval also promotes the applicant's
 * role to "organizer". Mirroring to the chain is a separate step (recordChainSync) so a chain
 * failure never loses the decision.
 */
export function decide(
  db: Db,
  profileId: string,
  adminId: string,
  decision: "approve" | "reject",
  reason?: string,
): AdminProfileView {
  const row = db.select().from(organizerProfiles).where(eq(organizerProfiles.id, profileId)).get();
  if (!row) throw new ProfileNotFoundError();
  if (row.kybStatus !== "pending") throw new AlreadyReviewedError(row.kybStatus);

  const approved = decision === "approve";
  db.transaction((tx) => {
    tx.update(organizerProfiles)
      .set({
        kybStatus: approved ? "verified" : "rejected",
        rejectionReason: approved ? null : (reason ?? null),
        reviewedBy: adminId,
        reviewedAt: new Date().toISOString(),
      })
      .where(eq(organizerProfiles.id, profileId))
      .run();
    if (approved) tx.update(users).set({ role: "organizer" }).where(eq(users.id, row.userId)).run();
  });

  const updated = getProfileById(db, profileId);
  if (!updated) throw new Error("Profile missing after decision");
  return updated;
}

export function recordChainSync(db: Db, profileId: string, result: ChainSyncResult): void {
  db.update(organizerProfiles)
    .set({
      chainSync: result.status,
      chainTxHash: result.status === "synced" ? result.txHash : null,
      chainError: result.status === "failed" ? result.error : null,
    })
    .where(eq(organizerProfiles.id, profileId))
    .run();
}

/** Public profile: only verified organizers are visible (FR-IDN-02). */
export function getPublicProfile(db: Db, profileId: string): PublicOrganizerProfile | null {
  const row = db.select().from(organizerProfiles).where(eq(organizerProfiles.id, profileId)).get();
  if (!row || row.kybStatus !== "verified") return null;
  return {
    id: row.id,
    legalName: row.legalName,
    registrationNumber: row.registrationNumber,
    jurisdiction: row.jurisdiction,
    verifiedAt: row.reviewedAt,
  };
}

/**
 * The gate for campaign creation: throws unless the user has a verified organizer profile.
 * Checked against the database on every call, never a token claim.
 */
export function requireVerifiedOrganizer(db: Db, userId: string): OrganizerProfile {
  const profile = getProfileByUser(db, userId);
  if (!profile) throw new OrganizerNotVerifiedError("none");
  if (profile.kybStatus !== "verified") throw new OrganizerNotVerifiedError(profile.kybStatus);
  return profile;
}
