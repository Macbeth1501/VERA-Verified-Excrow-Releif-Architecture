import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The head of every signed-in workspace page: an optional way back, the page title in the display
 * serif, and one plain introduction. `aside` sits on the title's right (for the page's one action).
 */
export function PageHead({
  back,
  title,
  lead,
  aside,
}: {
  back?: { href: string; label: string };
  title: string;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header>
      {back ? (
        <Link href={back.href} className="inline-flex min-h-8 items-center gap-1.5 text-sm text-sand hover:text-copper">
          <span aria-hidden>&larr;</span>
          {back.label}
        </Link>
      ) : null}
      <div className={`${back ? "mt-4" : ""} flex flex-wrap items-end justify-between gap-x-8 gap-y-4`}>
        <h1 className="min-w-0 text-4xl text-ink sm:text-5xl">{title}</h1>
        {aside}
      </div>
      {lead ? <p className="mt-4 max-w-[62ch] text-lg text-sand">{lead}</p> : null}
    </header>
  );
}
