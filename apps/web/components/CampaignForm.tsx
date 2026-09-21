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
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const labelClass = "text-sm font-medium text-zinc-800 dark:text-zinc-200";

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
      <p key={m} className="mt-1 text-sm text-red-600">
        {m}
      </p>
    ));

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6" noValidate>
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
        <p className="mt-1 text-sm text-zinc-500">
          The most you may spend on running costs. {CATEGORY_LABEL[category]} campaigns allow at most {ceiling}%. This
          limit is enforced by the contract, not just by us.
        </p>
        {messages("adminExpenseCapPct")}
      </div>

      <fieldset>
        <legend className={labelClass}>Milestones</legend>
        <p className="mt-1 text-sm text-zinc-500">
          Money is released in stages. Each milestone needs independent confirmations before its share can be paid out,
          and the shares must add up to exactly 100%.
        </p>

        <div className="mt-4 space-y-4">
          {rows.map((row, index) => (
            <div key={index} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Milestone {index + 1}</span>
                {rows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
                    className="text-sm text-red-700 underline dark:text-red-400"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <label htmlFor={`desc-${index}`} className="sr-only">
                Milestone {index + 1} description
              </label>
              <input
                id={`desc-${index}`}
                placeholder="What will be delivered?"
                value={row.description}
                onChange={(e) => updateRow(index, { description: e.target.value })}
                className={inputClass}
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`pct-${index}`} className="text-sm text-zinc-600 dark:text-zinc-400">
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
                  <label htmlFor={`att-${index}`} className="text-sm text-zinc-600 dark:text-zinc-400">
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
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setRows([...rows, { ...blankMilestone }])}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Add milestone
          </button>
          <p
            data-testid="milestone-total"
            className={`text-sm font-medium ${totalOk ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
          >
            Total: {total}% {totalOk ? "(ready)" : "of 100%"}
          </p>
        </div>
        {messages("milestones")}
      </fieldset>

      {formError ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {formError}
        </p>
      ) : null}

      {busy ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{busy}</p> : null}

      <button
        type="submit"
        disabled={busy !== null}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {busy ? "Working..." : "Create campaign"}
      </button>
    </form>
  );
}
