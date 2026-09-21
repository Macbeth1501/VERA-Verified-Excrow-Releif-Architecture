import Link from "next/link";
import { notFound } from "next/navigation";
import { BeneficiaryForm } from "@/components/BeneficiaryForm";
import { getProgramSalt, listBeneficiaries } from "@/lib/beneficiary/service";
import { requirePageUser } from "@/lib/campaigns/page-guard";
import { getCampaign, ownerUserId } from "@/lib/campaigns/service";
import { beneficiaryChain } from "@/lib/chain/registry";
import { explorerTxUrl } from "@/lib/explorer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Beneficiaries | VERA" };

const short = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-6)}`;
const STATUS_COPY = { CONFIRMED: "Registered on-chain", PENDING: "Pending", FAILED: "Failed, try again" } as const;
const NOTE = "mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200";

export default async function BeneficiariesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user } = await requirePageUser();
  const campaign = getCampaign(db, id);
  if (!campaign) notFound();
  if (user.id !== ownerUserId(db, id) && user.role !== "admin") notFound();

  const live = campaign.status === "LIVE";
  const configured = beneficiaryChain().configured();
  const salt = live ? getProgramSalt(db, user, id) : null;
  const list = live ? listBeneficiaries(db, user, id) : null;
  const rows = list?.ok ? list.beneficiaries : [];
  const confirmed = rows.filter((b) => b.status === "CONFIRMED").length;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link href={`/dashboard/campaigns/${id}`} className="text-sm text-zinc-600 underline dark:text-zinc-400">
        Back to the campaign
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Beneficiaries</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{campaign.title}</p>
      <p className="mt-4 text-zinc-700 dark:text-zinc-300">
        Register each person who will receive help. The same person can only be registered once per campaign, and their
        identity never reaches VERA: only a scrambled fingerprint does, and it is recorded publicly on the blockchain.
      </p>

      {!live ? (
        <p className={NOTE}>Publish the campaign first: beneficiaries are registered against its escrow account.</p>
      ) : !configured ? (
        <p className={NOTE}>
          Beneficiary registration is switched off on this server (the registry or the sponsor wallet is not configured).
        </p>
      ) : salt?.ok ? (
        <section className="mt-6 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Register a beneficiary</h2>
          <BeneficiaryForm campaignId={id} programSalt={salt.salt} />
        </section>
      ) : null}

      {live ? (
        <section className="mt-8">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
            Registered so far{" "}
            <span className="text-sm font-normal text-zinc-500" data-testid="beneficiary-count">
              ({confirmed} confirmed)
            </span>
          </h2>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No beneficiaries yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {rows.map((b) => (
                <li key={b.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800" data-testid="beneficiary-row">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{short(b.identityHash)}</span>
                    <span className="text-zinc-600 dark:text-zinc-400">{STATUS_COPY[b.status]}</span>
                  </div>
                  <p className="mt-1 text-zinc-500">
                    Paid by: {b.payoutMethod}
                    {b.txHash?.startsWith("0x") ? (
                      <>
                        {" · "}
                        <a className="underline" href={explorerTxUrl(b.txHash)} target="_blank" rel="noreferrer">
                          View on the explorer
                        </a>
                      </>
                    ) : null}
                  </p>
                  {b.error && b.status !== "CONFIRMED" ? <p className="mt-1 text-red-700 dark:text-red-400">{b.error}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
