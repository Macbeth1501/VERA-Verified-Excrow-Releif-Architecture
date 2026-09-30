"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { identityChange, navLinksFor, roleLabel, type NavIdentity } from "@/lib/nav/roles";

const POLL_MS = 15_000;

async function fetchIdentity(): Promise<NavIdentity | null | undefined> {
  try {
    const res = await fetch("/api/v1/auth/session", { cache: "no-store" });
    if (!res.ok) return undefined;
    return ((await res.json()) as { user: NavIdentity | null }).user;
  } catch {
    return undefined; // offline or server restarting: say nothing rather than guess
  }
}

/**
 * Role-aware navigation, and the guard against a silent identity switch. All windows in one
 * browser profile share a single session cookie, so signing in as someone else in another window
 * changes who THIS window is on its next click. `baseline` is who the page on screen was loaded
 * for; it is reset on every navigation, login and logout (the page is then fresh), but not on
 * background polling, so a stale window notices and offers a refresh.
 */
export function SiteNav() {
  const pathname = usePathname();
  const [baseline, setBaseline] = useState<NavIdentity | null | undefined>(undefined);
  const [current, setCurrent] = useState<NavIdentity | null | undefined>(undefined);

  const rebaseline = useCallback(async () => {
    const id = await fetchIdentity();
    if (id === undefined) return;
    setBaseline(id);
    setCurrent(id);
  }, []);

  useEffect(() => {
    // A navigation renders the page for the cookie as it is now, so this is the new baseline.
    let cancelled = false;
    void fetchIdentity().then((id) => {
      if (cancelled || id === undefined) return;
      setBaseline(id);
      setCurrent(id);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    const onAuth = () => void rebaseline();
    const poll = async () => {
      const id = await fetchIdentity();
      if (id !== undefined) setCurrent(id);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, POLL_MS);
    window.addEventListener("vera:auth-changed", onAuth);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("vera:auth-changed", onAuth);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [rebaseline]);

  const change = baseline === undefined || current === undefined ? { kind: "same" as const } : identityChange(baseline, current);
  const shown = current ?? null;

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800" data-testid="site-nav">
      <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3 text-sm">
        <Link href="/" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          VERA
        </Link>
        {shown ? (
          <>
            {navLinksFor(shown.role).map((l) => (
              <Link key={l.href + l.label} href={l.href} className="text-zinc-700 hover:underline dark:text-zinc-300">
                {l.label}
              </Link>
            ))}
            <span className="ml-auto text-zinc-500" data-testid="nav-identity">
              {shown.email} ({roleLabel(shown.role)})
            </span>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/campaigns" className="text-zinc-700 hover:underline dark:text-zinc-300">
              Campaigns
            </Link>
            <Link href="/activity" className="text-zinc-700 hover:underline dark:text-zinc-300">
              Chain activity
            </Link>
            {current === null ? (
              <span className="ml-auto flex gap-4">
                <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-50">
                  Sign in
                </Link>
                <Link href="/register" className="text-zinc-700 underline dark:text-zinc-300">
                  Create account
                </Link>
              </span>
            ) : null}
          </>
        )}
      </nav>
      {change.kind !== "same" ? (
        <div role="alert" className="border-t border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" data-testid="identity-warning">
          <span className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1">
            {change.kind === "signed-out" ? (
              <span>You were signed out in another window. This page may be out of date.</span>
            ) : (
              <span>
                Another window signed in as {change.to.email} ({roleLabel(change.to.role)}). All windows in this browser share one
                sign-in, so this page may show the wrong account. To use two roles at once, open the second in a private window.
              </span>
            )}
            <button type="button" onClick={() => window.location.reload()} className="font-medium underline">
              Refresh this page
            </button>
          </span>
        </div>
      ) : null}
    </header>
  );
}
