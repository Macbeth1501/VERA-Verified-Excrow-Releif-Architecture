import Link from "next/link";
import type { ReactNode } from "react";
import { formatMinorUnits } from "@/lib/campaigns/money";
import type { MilestoneView } from "@/lib/escrow/service";
import { ActionButton } from "./ActionButton";
import { AttestForm } from "./AttestForm";

export type CardMode = "attest" | "approve" | "release";

const STATUS_TONE: Record<string, string> = {
  Pending: "border-warn/50 bg-warn-wash text-warn",
  Verified: "border-ok/50 bg-ok-wash text-ok",
  Released: "border-ok/50 bg-ok-wash text-ok",
};

const KIND_LABEL = { attestation: "Confirmed by", council_approval: "Approved by", release: "Released by" } as const;

/**
 * One milestone as its contract reports it, with the action the viewer's role allows. Counts and
 * status come from the chain, never from the database.
 */
export function MilestoneCard({
  view,
  mode,
  actedByMe = false,
  releasedSlot,
  hideCampaign = false,
}: {
  view: MilestoneView;
  mode: CardMode;
  /** The viewer already has a confirmed action of this kind on this milestone. */
  actedByMe?: boolean;
  /** Shown under a released milestone, e.g. the organizer's "record payout" form. */
  releasedSlot?: ReactNode;
  /** On a page that is already about this campaign, the campaign link above the milestone is noise. */
  hideCampaign?: boolean;
}) {
  const s = view.state;
  const overLimit = s ? BigInt(s.releasableAmount) > BigInt(s.autoReleaseLimit) : false;
  const needsCouncil = overLimit && s !== null;

  return (
    <li className="grid gap-x-6 py-5 sm:grid-cols-[2.5rem_1fr]" data-testid="milestone-card">
      <span aria-hidden className="font-display text-2xl text-copper">
        {view.index + 1}
      </span>
      <div className="min-w-0">
      {hideCampaign ? null : (
        <p className="text-[13px] text-dim">
          <Link href={`/campaigns/${view.campaignId}`} className="underline">
            {view.campaignTitle}
          </Link>{" "}
          · milestone {view.index + 1}
        </p>
      )}
      <p className="text-lg text-ink">{view.description}</p>

      {!view.definedOnChain ? (
        <p className="mt-2 text-sm text-warn">
          {view.chainError ?? "Not registered on the blockchain yet: the organizer has to finish publishing."}
        </p>
      ) : !s ? (
        <p className="mt-2 text-sm text-warn">The blockchain could not be read just now.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-sand" data-testid="milestone-summary">
            <span className={`mr-1 inline-block rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${STATUS_TONE[s.status] ?? "border-rule-strong text-sand"}`}>{s.status}</span> · {s.attestationCount} of {s.requiredAttestations} confirmations
            {s.status !== "Pending" ? (
              <>
                {" "}
                · {s.councilApprovals} of {s.councilThreshold} council approvals
                {needsCouncil ? " (needed: payout above the automatic limit)" : " (not needed: below the automatic limit)"}
              </>
            ) : null}
            {s.status !== "Released" ? <> · pays {formatMinorUnits(s.releasableAmount)}</> : null}
          </p>

          {view.actions.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-[13px] text-dim">
              {view.actions.map((a, i) => (
                <li key={i}>
                  {KIND_LABEL[a.kind]} <span className="font-mono">{a.actorAddress.slice(0, 8)}…</span> ({a.status.toLowerCase()})
                  {a.evidenceDocumentId ? (
                    <>
                      {" "}
                      <a href={`/api/v1/documents/${a.evidenceDocumentId}`} target="_blank" rel="noreferrer" className="underline">
                        view evidence
                      </a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {mode === "attest" && s.status === "Pending" && !actedByMe ? <AttestForm milestoneId={view.id} /> : null}
          {mode === "attest" && actedByMe ? <p className="mt-2 text-sm text-ok">You confirmed this one.</p> : null}

          {mode === "approve" && s.status === "Verified" && !actedByMe ? (
            <ActionButton url={`/api/v1/milestones/${view.id}/council-approval`} label="Approve this release" busyLabel="Approving on the blockchain..." tone="primary" />
          ) : null}
          {mode === "approve" && actedByMe && s.status !== "Released" ? (
            <p className="mt-2 text-sm text-ok">You approved this one.</p>
          ) : null}

          {(mode === "approve" || mode === "release") && s.status === "Verified" ? (
            <ActionButton url={`/api/v1/milestones/${view.id}/release`} label="Release the money" busyLabel="Releasing on the blockchain..." tone="primary" />
          ) : null}
          {s.status === "Released" ? <p className="mt-2 text-sm text-ok">Released to the organizer.</p> : null}
          {s.status === "Released" ? releasedSlot : null}
        </>
      )}
      </div>
    </li>
  );
}
