import Link from "next/link";
import { formatMinorUnits } from "@/lib/campaigns/money";
import type { MilestoneView } from "@/lib/escrow/service";
import { ActionButton } from "./ActionButton";
import { AttestForm } from "./AttestForm";

export type CardMode = "attest" | "approve" | "release";

const KIND_LABEL = { attestation: "Confirmed by", council_approval: "Approved by", release: "Released by" } as const;

/**
 * One milestone as its contract reports it, with the action the viewer's role allows. Counts and
 * status come from the chain, never from the database.
 */
export function MilestoneCard({
  view,
  mode,
  actedByMe = false,
}: {
  view: MilestoneView;
  mode: CardMode;
  /** The viewer already has a confirmed action of this kind on this milestone. */
  actedByMe?: boolean;
}) {
  const s = view.state;
  const overLimit = s ? BigInt(s.releasableAmount) > BigInt(s.autoReleaseLimit) : false;
  const needsCouncil = overLimit && s !== null;

  return (
    <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800" data-testid="milestone-card">
      <p className="text-xs text-zinc-500">
        <Link href={`/campaigns/${view.campaignId}`} className="underline">
          {view.campaignTitle}
        </Link>{" "}
        · milestone {view.index + 1}
      </p>
      <p className="mt-1 text-zinc-800 dark:text-zinc-200">{view.description}</p>

      {!view.definedOnChain ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          {view.chainError ?? "Not registered on the blockchain yet: the organizer has to finish publishing."}
        </p>
      ) : !s ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">The blockchain could not be read just now.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400" data-testid="milestone-summary">
            <span className="font-medium">{s.status}</span> · {s.attestationCount} of {s.requiredAttestations} confirmations
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
            <ul className="mt-2 space-y-0.5 text-xs text-zinc-500">
              {view.actions.map((a, i) => (
                <li key={i}>
                  {KIND_LABEL[a.kind]} <span className="font-mono">{a.actorAddress.slice(0, 8)}…</span> ({a.status.toLowerCase()})
                </li>
              ))}
            </ul>
          ) : null}

          {mode === "attest" && s.status === "Pending" && !actedByMe ? <AttestForm milestoneId={view.id} /> : null}
          {mode === "attest" && actedByMe ? <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">You confirmed this one.</p> : null}

          {mode === "approve" && s.status === "Verified" && !actedByMe ? (
            <ActionButton url={`/api/v1/milestones/${view.id}/council-approval`} label="Approve this release" busyLabel="Approving on the blockchain..." tone="primary" />
          ) : null}
          {mode === "approve" && actedByMe && s.status !== "Released" ? (
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">You approved this one.</p>
          ) : null}

          {(mode === "approve" || mode === "release") && s.status === "Verified" ? (
            <ActionButton url={`/api/v1/milestones/${view.id}/release`} label="Release the money" busyLabel="Releasing on the blockchain..." tone="primary" />
          ) : null}
          {s.status === "Released" ? <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">Released to the organizer.</p> : null}
        </>
      )}
    </li>
  );
}
