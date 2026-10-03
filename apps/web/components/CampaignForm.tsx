"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { CAMPAIGN_CATEGORIES, CATEGORY_LABEL, ceilingFor, type CampaignCategory } from "@/lib/campaigns/ceilings";
import { rupeesToMinorUnits } from "@/lib/campaigns/money";
import { createCampaignSchema, REQUIRED_MILESTONE_TOTAL, sumPct } from "@/lib/campaigns/validation";

type FieldErrors = Record<string, string[] | undefined>;

interface MilestoneDraft {
  description: string;
  targetPct: string;
  requiredAttestations: string;
}

const blankMilestone: MilestoneDraft = { description: "", targetPct: "", requiredAttestations: "2" };

const inputClass =
  "mt-1.5 w-full rounded-md border border-rule-strong bg-well px-3 py-2.5 text-ink focus:border-copper";
const labelClass = "text-sm font-medium text-ink";

export function CampaignForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<CampaignCategory>("DISASTER_RELIEF");
  const [goal, setGoal] = useState("");
  const [adminCap, setAdminCap] = useState("10");
  const [rows, setRows] = useState<MilestoneDraft[]>([{ ...blankMilestone }]);
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const ceiling = ceilingFor(category);
  const total = useMemo(() => sumPct(rows.map((r) => ({ targetPct: Number(r.targetPct) }))), [rows]);
  const totalOk = total === REQUIRED_MILESTONE_TOTAL;

  function payload() {
    return {
      title: title.trim(),
      summary: summary.trim(),
      category,
      fundingGoalMinorUnits: rupeesToMinorUnits(goal) ?? "",
      adminExpenseCapPct: Number(adminCap),
      milestones: rows.map((r) => ({
        description: r.description.trim(),
        targetPct: Number(r.targetPct),
        requiredAttestations: Number(r.requiredAttestations),
      })),
    };
  }

  function updateRow(index: number, patch: Partial<MilestoneDraft>) {
    setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    // Layer 1 of three (SPDD 19.2): instant feedback using the exact rules the server applies.
    const body = payload();
    const parsed = createCampaignSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as FieldErrors;
      if (!rupeesToMinorUnits(goal)) fieldErrors.fundingGoalMinorUnits = ["Enter a funding goal greater than zero"];
      setErrors(fieldErrors);
      return;
    }

    try {
      setBusy("Saving your campaign...");
      const res = await fetch("/api/v1/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const created = await res.json().catch(() => null);
      if (!res.ok) {
        setErrors((created?.error?.details as FieldErrors | undefined) ?? {});
        setFormError(created?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }

      // Publishing is a separate call so a slow or failing chain never loses the campaign.
      setBusy("Publishing to the blockchain. This can take up to a minute...");
      const published = await fetch(`/api/v1/campaigns/${created.campaign_id}/deploy`, { method: "POST" }).catch(() => null);
      if (published?.ok) {
        // The vault exists now; register its milestones on the milestone manager so attestors can see
        // them, as the retry button does. A failure is shown on the campaign page with its own retry.
        setBusy("Registering the milestones...");
        await fetch(`/api/v1/campaigns/${created.campaign_id}/milestones/define`, { method: "POST" }).catch(() => null);
      }
      router.push(`/dashboard/campaigns/${created.campaign_id}`);
      router.refresh();
    } catch {
      setFormError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const messages = (key: string) =>
    errors[key]?.map((m) => (
      <p key={m} className="mt-1 text-sm text-bad">
        {m}
      </p>
    ));

  return (
    <form onSubmit={onSubmit} className="mt-10 max-w-3xl space-y-8" noValidate>
      <h2 className="border-b border-rule pb-3 text-2xl text-ink">The campaign</h2>
      <div>
        <label htmlFor="title" className={labelClass}>
          Campaign title
        </label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        {messages("title")}
      </div>

      <div>
        <label htmlFor="summary" className={labelClass}>
          What is this campaign for?
        </label>
        <textarea id="summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} className={inputClass} />
        {messages("summary")}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className={labelClass}>
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CampaignCategory)}
            className={inputClass}
          >
            {CAMPAIGN_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="goal" className={labelClass}>
            Funding goal (rupees)
          </label>
          <input id="goal" inputMode="decimal" placeholder="100000" value={goal} onChange={(e) => setGoal(e.target.value)} className={inputClass} />
          {messages("fundingGoalMinorUnits")}
        </div>
      </div>

      <div>
        <label htmlFor="adminCap" className={labelClass}>
          Admin cost cap (%)
        </label>
        <input id="adminCap" inputMode="numeric" value={adminCap} onChange={(e) => setAdminCap(e.target.value)} className={inputClass} />
        <p className="mt-1 text-sm text-dim">
          The most you may spend on running costs. {CATEGORY_LABEL[category]} campaigns allow at most {ceiling}%. This
          limit is enforced by the contract, not just by us.
        </p>
        {messages("adminExpenseCapPct")}
      </div>

      <fieldset>
        <legend className="w-full border-b border-rule pb-3 font-display text-2xl font-semibold text-ink">Milestones</legend>
        <p className="mt-3 max-w-[62ch] text-sm text-sand">
          Money is released in stages. Each milestone needs independent confirmations before its share can be paid out,
          and the shares must add up to exactly 100%.
        </p>

        <ol className="mt-2 divide-y divide-rule">
          {rows.map((row, index) => (
            <li key={index} className="grid gap-x-6 gap-y-3 py-5 sm:grid-cols-[2.5rem_1fr]">
              <span aria-hidden className="font-display text-2xl text-copper">
                {index + 1}
              </span>
              <div>
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor={`desc-${index}`} className="text-sm font-medium text-ink">
                    Milestone {index + 1}
                  </label>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setRows(rows.filter((_, i) => i !== index))}
                      className="text-sm text-bad underline"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <input
                  id={`desc-${index}`}
                  placeholder="What will be delivered?"
                  value={row.description}
                  onChange={(e) => updateRow(index, { description: e.target.value })}
                  className={inputClass}
                />
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`pct-${index}`} className="text-sm text-sand">
                      Share of the goal (%)
                    </label>
                    <input
                      id={`pct-${index}`}
                      inputMode="numeric"
                      value={row.targetPct}
                      onChange={(e) => updateRow(index, { targetPct: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={`att-${index}`} className="text-sm text-sand">
                      Confirmations needed
                    </label>
                    <input
                      id={`att-${index}`}
                      inputMode="numeric"
                      value={row.requiredAttestations}
                      onChange={(e) => updateRow(index, { requiredAttestations: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-4">
          <button
            type="button"
            onClick={() => setRows([...rows, { ...blankMilestone }])}
            className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink hover:bg-panel"
          >
            Add milestone
          </button>
          <p
            data-testid="milestone-total"
            className={`num inline-flex items-center gap-2 text-sm font-medium ${totalOk ? "text-ok" : "text-warn"}`}
          >
            <span aria-hidden className={`h-2 w-2 rounded-full ${totalOk ? "bg-ok" : "border border-warn"}`} />
            Total: {total}% {totalOk ? "(ready)" : "of 100%"}
          </p>
        </div>
        {messages("milestones")}
      </fieldset>

      {formError ? (
        <p role="alert" className="rounded-md bg-bad-wash px-3 py-2 text-sm text-bad">
          {formError}
        </p>
      ) : null}

      {busy ? <p className="text-sm text-sand">{busy}</p> : null}

      <button
        type="submit"
        disabled={busy !== null}
        className="rounded-md bg-copper px-6 py-3 font-semibold text-on-copper hover:bg-copper-hover disabled:opacity-60"
      >
        {busy ? "Working..." : "Create campaign"}
      </button>
      <p className="-mt-4 text-sm text-dim">Creating the campaign also publishes its escrow account to the test network.</p>
    </form>
  );
}
