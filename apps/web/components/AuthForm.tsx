"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Mode = "register" | "login";
type FieldErrors = Record<string, string[] | undefined>;

const COPY = {
  register: {
    title: "Create your donor account",
    lead: "Sign up with your email. We set up your donation account for you, so there is nothing else to install or learn.",
    submit: "Create account",
    busy: "Creating your account...",
    endpoint: "/api/v1/auth/register",
    switchText: "Already have an account?",
    switchLink: "Sign in",
    switchHref: "/login",
  },
  login: {
    title: "Welcome back",
    lead: "Sign in to see your account and balance.",
    submit: "Sign in",
    busy: "Signing in...",
    endpoint: "/api/v1/auth/login",
    switchText: "New here?",
    switchLink: "Create an account",
    switchHref: "/register",
  },
} as const;

function FieldMessages({ messages }: { messages: string[] | undefined }) {
  return (
    <>
      {messages?.map((m) => (
        <p key={m} className="mt-1 text-sm text-bad">
          {m}
        </p>
      ))}
    </>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ownWallet, setOwnWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const payload: Record<string, string> = { email, password };
      if (mode === "register" && ownWallet.trim()) payload.walletAddress = ownWallet.trim();
      const res = await fetch(copy.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        window.dispatchEvent(new Event("vera:auth-changed"));
        router.push("/dashboard");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      setFieldErrors((body?.error?.details as FieldErrors | undefined) ?? {});
      setFormError(body?.error?.message ?? "Something went wrong. Please try again.");
    } catch {
      setFormError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1.5 min-h-11 w-full rounded-md border border-rule-strong bg-well px-3 text-ink focus:border-copper";

  return (
    <main className={`grid w-full flex-1 gap-x-24 gap-y-14 py-14 lg:py-20 ${mode === "register" ? "lg:grid-cols-[minmax(0,26rem)_1fr]" : "lg:grid-cols-[minmax(0,26rem)]"}`}>
      <div>
      <h1 className="text-4xl text-ink">{copy.title}</h1>
      <p className="mt-3 text-lg text-sand">{copy.lead}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="text-sm font-medium text-ink ">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
          />
          <FieldMessages messages={fieldErrors.email} />
        </div>

        <div>
          <label htmlFor="password" className="text-sm font-medium text-ink ">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
          />
          {mode === "register" ? <p className="mt-1 text-sm text-dim">At least 12 characters.</p> : null}
          <FieldMessages messages={fieldErrors.password} />
        </div>

        {mode === "register" ? (
          <details className="rounded-md border border-rule p-3 ">
            <summary className="cursor-pointer text-sm font-medium text-sand ">
              Advanced: I already have a crypto wallet
            </summary>
            <label htmlFor="wallet" className="mt-3 block text-sm text-sand ">
              Wallet address (optional). Leave empty and we will create one for you.
            </label>
            <input
              id="wallet"
              type="text"
              placeholder="0x..."
              value={ownWallet}
              onChange={(e) => setOwnWallet(e.target.value)}
              className={input}
            />
            <FieldMessages messages={fieldErrors.walletAddress} />
          </details>
        ) : null}

        {formError ? (
          <p role="alert" className="rounded-md bg-bad-wash px-3 py-2 text-sm text-bad ">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-md bg-copper px-4 font-medium text-on-copper hover:bg-copper-hover disabled:opacity-60"
        >
          {busy ? copy.busy : copy.submit}
        </button>
      </form>

      <p className="mt-6 text-sm text-sand ">
        {copy.switchText}{" "}
        <Link href={copy.switchHref} className="font-medium text-ink underline ">
          {copy.switchLink}
        </Link>
      </p>
      {mode === "login" ? (
        <p className="mt-2 text-sm text-dim">
          New to VERA?{" "}
          <Link href="/how-it-works" className="underline">
            See how it works
          </Link>{" "}
          before you sign up.
        </p>
      ) : null}
      </div>
      {mode === "register" ? (
      <aside className="lg:pt-3" aria-label="What an account is for">
        <h2 className="text-2xl text-ink">What an account is for</h2>
        <ul className="mt-5 max-w-[46ch] divide-y divide-rule border-y border-rule">
          <li className="py-4">
            <p className="font-medium text-ink">Donate to a campaign</p>
            <p className="mt-1 text-sm text-sand">It takes about a minute and you do not need any crypto knowledge. Your money is locked in a public escrow account.</p>
          </li>
          <li className="py-4">
            <p className="font-medium text-ink">Follow where it goes</p>
            <p className="mt-1 text-sm text-sand">See each stage confirmed by independent people, released, and paid out, with a link to check every step yourself.</p>
          </li>
          <li className="py-4">
            <p className="font-medium text-ink">Run a campaign</p>
            <p className="mt-1 text-sm text-sand">Organizers are verified first. Apply from your account once you have signed up.</p>
          </li>
        </ul>
      </aside>
      ) : null}
    </main>
  );
}
