import { notFound } from "next/navigation";
import { BeneficiaryForm } from "@/components/BeneficiaryForm";
import { PageHead } from "@/components/PageHead";
import { getProgramSalt, listBeneficiaries } from "@/lib/beneficiary/service";
import { requirePageUser } from "@/lib/campaigns/page-guard";
import { getCampaign, ownerUserId } from "@/lib/campaigns/service";
import { beneficiaryChain } from "@/lib/chain/registry";
import { explorerTxUrl } from "@/lib/explorer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Beneficiaries | VERA" };

const short = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-6)}`;
const STATUS_COPY = { CONFIRMED: "Registered on-chain", PENDING: "Pending", FAILED: "Failed, try again" } as const;
const NOTE = "mt-8 max-w-[62ch] rounded-md bg-warn-wash px-4 py-3 text-sm text-warn";
const STATUS_TONE = { CONFIRMED: "text-ok", PENDING: "text-warn", FAILED: "text-bad" } as const;
const STATUS_DOT = { CONFIRMED: "bg-ok", PENDING: "border border-warn", FAILED: "bg-bad" } as const;

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
    <main className="w-full flex-1 py-12 lg:py-16">
      <PageHead
        back={{ href: `/dashboard/campaigns/${id}`, label: campaign.title }}
        title="Beneficiaries"
        lead="Register each person who will receive help. The same person can only be registered once per campaign, and their identity never reaches VERA: only a scrambled fingerprint does, and it is recorded publicly on the blockchain."
      />

      {!live ? (
        <p className={NOTE}>Publish the campaign first: beneficiaries are registered against its escrow account.</p>
      ) : !configured ? (
        <p className={NOTE}>
          Beneficiary registration is switched off on this server (the registry or the sponsor wallet is not configured).
        </p>
      ) : null}

      {live ? (
        <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section aria-labelledby="registered-heading">
            <h2 id="registered-heading" className="border-b border-rule pb-3 text-2xl text-ink">
              Registered so far{" "}
              <span className="num font-sans text-base font-normal text-dim" data-testid="beneficiary-count">
                ({confirmed} confirmed)
              </span>
            </h2>
            {rows.length === 0 ? (
              <p className="mt-4 text-dim">No beneficiaries yet.</p>
            ) : (
              <ul className="divide-y divide-rule">
                {rows.map((b) => (
                  <li key={b.id} className="py-4 text-sm" data-testid="beneficiary-row">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <span className="font-mono text-[13px] text-sand">{short(b.identityHash)}</span>
                      <span className={`inline-flex items-center gap-2 font-medium ${STATUS_TONE[b.status]}`}>
                        <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS_DOT[b.status]}`} />
                        {STATUS_COPY[b.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-dim">
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
                    {b.error && b.status !== "CONFIRMED" ? <p className="mt-1 text-bad">{b.error}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {configured && salt?.ok ? (
            <section aria-labelledby="register-heading" className="self-start rounded-lg border border-rule bg-panel p-5">
              <h2 id="register-heading" className="text-xl text-ink">
                Register a beneficiary
              </h2>
              <BeneficiaryForm campaignId={id} programSalt={salt.salt} />
            </section>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
