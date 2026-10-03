import type { ReactNode } from "react";

/** The four stages every rupee passes through. One vocabulary, reused on the home page, milestones and activity. */
export const STAGES = [
  { key: "locked", label: "Locked", text: "Donations sit in a public escrow account. Nobody, including the organizer, can spend them." },
  { key: "confirmed", label: "Confirmed", text: "Independent people on the ground confirm a milestone with evidence. No one can confirm their own work." },
  { key: "released", label: "Released", text: "Only then does that stage's share move to the organizer. Larger amounts also need a council to approve." },
  { key: "paid", label: "Paid out", text: "The organizer records each payment to a registered beneficiary, and each person can be paid only once." },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

/** Authored icons, one stroke weight (1.6) on a 24px box. */
function Glyph({ stage }: { stage: StageKey }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  switch (stage) {
    case "locked":
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="9" rx="1.5" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "confirmed":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.5 12.3 2.4 2.4 4.7-5" />
        </svg>
      );
    case "released":
      return (
        <svg {...common}>
          <path d="M4 12h12" />
          <path d="m12 7 5 5-5 5" />
          <path d="M20 5v14" />
        </svg>
      );
    case "paid":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 20c.6-3.6 3.1-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
        </svg>
      );
  }
}

const node = "relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border";

/**
 * The mechanism as a vertical ledger rail (home page). `figures` adds a live amount to a stage when
 * the chain reader has data; without it the stage shows only what it means.
 */
export function StageRail({ figures }: { figures?: Partial<Record<StageKey, ReactNode>> }) {
  return (
    <ol className="relative" aria-label="How a donation moves through VERA">
      <span aria-hidden className="rail-line absolute left-[17px] top-5 bottom-5 w-px bg-copper/60" />
      {STAGES.map((s) => (
        <li key={s.key} className="relative flex gap-5 pb-9 last:pb-0" data-testid={`stage-${s.key}`}>
          <span className={`${node} border-copper bg-well text-copper`}>
            <Glyph stage={s.key} />
          </span>
          <div className="min-w-0 flex-1 border-b border-rule pb-7 last:border-b-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h3 className="text-lg text-ink">{s.label}</h3>
              {figures?.[s.key] ? <span className="num text-lg font-semibold text-copper">{figures[s.key]}</span> : null}
            </div>
            <p className="mt-1 max-w-[46ch] text-sm text-sand">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * A single milestone's position on the same four stages, drawn as a horizontal track.
 * `reached` counts stages completed: 1 = locked only, 4 = paid out.
 */
export function StageTrack({ reached }: { reached: 1 | 2 | 3 | 4 }) {
  const current = STAGES[reached - 1].label;
  return (
    <div className="mt-3" role="group" aria-label={`Stage ${reached} of 4: ${current}`}>
      <div className="relative flex items-center justify-between">
        <span aria-hidden className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-rule" />
        <span
          aria-hidden
          className="rail-line-x absolute left-2 top-1/2 h-px -translate-y-1/2 bg-copper"
          style={{ width: `calc((100% - 1rem) * ${(reached - 1) / 3})` }}
        />
        {STAGES.map((s, i) => {
          const done = i < reached;
          return (
            <span
              key={s.key}
              className={`relative z-10 grid h-4 w-4 place-items-center rounded-full border ${done ? "border-copper bg-copper" : "border-rule-strong bg-well"}`}
            >
              {done ? (
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="var(--color-on-copper)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m2.5 6.2 2.3 2.3 4.7-5" />
                </svg>
              ) : null}
            </span>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[13px]">
        {STAGES.map((s, i) => (
          <span key={s.key} className={i === reached - 1 ? "font-medium text-ink" : i < reached ? "text-sand" : "text-dim"}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
