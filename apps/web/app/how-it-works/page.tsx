import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { StageRail } from "@/components/StageRail";

export const metadata = { title: "How VERA works | VERA" };

const PEOPLE = [
  { who: "Donors", what: "Give practice money to a campaign. They need no crypto knowledge; VERA creates and funds a wallet for them." },
  { who: "Organizers", what: "Verified organizations that run a campaign, ask for each stage to be released, register who will be helped and record every payment." },
  { who: "Attestors", what: "Independent people on the ground who confirm, with evidence, that a milestone is really done. An organizer can never confirm their own work." },
  { who: "The council", what: "Members who approve larger releases (over 100 mINR needs three approvals), so no single person can move a large sum." },
  { who: "Administrators", what: "Approve organizers and appoint attestors and council members. They cannot spend or release a campaign's money." },
];

const WORDS: { term: string; plain: string }[] = [
  { term: "Escrow account", plain: "A public account that holds a campaign's money. Funds only leave it when a milestone has been confirmed. The organizer cannot take money out on their own." },
  { term: "Milestone", plain: "One stage of the work, with its share of the goal. The shares of a campaign add up to exactly 100%." },
  { term: "Confirmation", plain: "An attestor's signed statement that a milestone is done. Each milestone needs at least two different people." },
  { term: "Release", plain: "Moving a confirmed milestone's share from the escrow account to the organizer." },
  { term: "Payout", plain: "The organizer recording a payment to a registered beneficiary. Each person can be paid only once per milestone." },
  { term: "Beneficiary fingerprint", plain: "A scrambled code made in the organizer's browser from a person's identifying detail. It lets the system stop duplicates without anyone at VERA ever seeing who the person is." },
  { term: "mINR", plain: "Practice rupees on a test network. They have no real value." },
  { term: "Reconciliation", plain: "A check that the figures on a campaign page match what the escrow account really holds on the blockchain, to the last unit." },
  { term: "Block and block number", plain: "The blockchain is a list of blocks. \"Data as of block N\" says how recent the information on screen is." },
  { term: "Block explorer", plain: "A public website (Polygonscan) where anyone can look up a transaction or account without trusting VERA." },
  { term: "Transaction hash", plain: "The unique reference of one recorded step on the blockchain. Every row on Chain activity links to its own." },
];

const CONTRACTS = [
  { name: "CampaignFactory", plain: "Creates each campaign's escrow account and checks the organizer is verified and the admin cost cap is within the limit." },
  { name: "Campaign vault", plain: "The escrow account itself. One per campaign." },
  { name: "MilestoneManager", plain: "The rulebook for milestones: counts confirmations and approvals and decides when money may be released." },
  { name: "BeneficiaryRegistry", plain: "The public list of beneficiary fingerprints, so the same person cannot be registered twice for a campaign." },
  { name: "Disbursement", plain: "Records each payout and refuses one that is not allowed (not released, not registered, already paid, or more than was released)." },
];

const H2 = "border-b border-rule pb-3 text-2xl text-ink";

export default function HowItWorksPage() {
  return (
    <main className="w-full flex-1 py-12 lg:py-16">
      <PageHead
        title="How VERA works"
        lead="VERA holds donations in a public escrow account and releases them in stages, only after independent people confirm the work. Everything shown on the site can be checked on the blockchain by anyone."
      />
      <p className="mt-4 max-w-[62ch] rounded-md bg-panel px-4 py-3 text-sm text-sand">
        This is a testnet demonstration. The money is practice money and nothing here has real value, but every transaction is real and public.
      </p>

      <div className="mt-12 grid gap-x-20 gap-y-14 lg:grid-cols-12">
        <section aria-labelledby="stages-heading" className="lg:col-span-6">
          <h2 id="stages-heading" className={H2}>
            The journey of a donation
          </h2>
          <div className="mt-6">
            <StageRail />
          </div>
        </section>

        <section aria-labelledby="checks-heading" className="lg:col-span-6">
          <h2 id="checks-heading" className={H2}>
            Why you do not have to trust us
          </h2>
          <ul className="divide-y divide-rule text-sand">
            <li className="py-3.5">Funds are never handed over up front. They leave the escrow account only through a confirmed milestone.</li>
            <li className="py-3.5">Organizers cannot verify their own work, and no single attestor can verify a milestone alone.</li>
            <li className="py-3.5">Admin overhead is capped by the contract itself (10% to 20% depending on the category), not by policy.</li>
            <li className="py-3.5">The same person cannot be paid twice: a repeat registration is refused by the database and by the blockchain.</li>
            <li className="py-3.5">
              Every campaign page is compared with the blockchain. A green seal means an exact match; anything else is shown honestly as
              unavailable or mismatched, never hidden.
            </li>
            <li className="py-3.5">
              You can check any figure yourself on the{" "}
              <Link href="/activity" className="underline">
                Chain activity
              </Link>{" "}
              page, which links every step to the public block explorer.
            </li>
          </ul>
        </section>
      </div>

      <section aria-labelledby="people-heading" className="mt-16">
        <h2 id="people-heading" className={H2}>
          Who does what
        </h2>
        <dl className="grid gap-x-12 md:grid-cols-2">
          {PEOPLE.map((p) => (
            <div key={p.who} className="border-b border-rule py-4">
              <dt className="font-display text-lg text-ink">{p.who}</dt>
              <dd className="mt-1 text-sand">{p.what}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="words-heading" className="mt-16">
        <h2 id="words-heading" className={H2}>
          Words we use
        </h2>
        <dl className="divide-y divide-rule">
          {WORDS.map((w) => (
            <div key={w.term} className="grid gap-x-8 py-4 sm:grid-cols-[14rem_1fr]">
              <dt className="font-medium text-ink">{w.term}</dt>
              <dd className="max-w-[70ch] text-sand">{w.plain}</dd>
            </div>
          ))}
        </dl>
        <details className="mt-6 border-y border-rule">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-ink">The contracts behind it, in plain words</summary>
          <dl className="divide-y divide-rule pb-2">
            {CONTRACTS.map((c) => (
              <div key={c.name} className="grid gap-x-8 py-3 sm:grid-cols-[14rem_1fr]">
                <dt className="font-mono text-[13px] text-ink">{c.name}</dt>
                <dd className="max-w-[70ch] text-sand">{c.plain}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      <p className="mt-16 flex flex-wrap gap-x-8 gap-y-2 border-t border-rule pt-6">
        <Link href="/campaigns" className="inline-flex min-h-8 items-center font-medium underline">
          Browse campaigns
        </Link>
        <Link href="/activity" className="inline-flex min-h-8 items-center font-medium underline">
          See every transaction
        </Link>
      </p>
    </main>
  );
}
