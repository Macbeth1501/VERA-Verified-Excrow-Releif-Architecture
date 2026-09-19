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
        <p key={m} className="mt-1 text-sm text-red-600">
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
        router.push("/account");
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
    "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{copy.title}</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">{copy.lead}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
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
          <label htmlFor="password" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
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
          {mode === "register" ? <p className="mt-1 text-sm text-zinc-500">At least 12 characters.</p> : null}
          <FieldMessages messages={fieldErrors.password} />
        </div>

        {mode === "register" ? (
          <details className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Advanced: I already have a crypto wallet
            </summary>
            <label htmlFor="wallet" className="mt-3 block text-sm text-zinc-600 dark:text-zinc-400">
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
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {busy ? copy.busy : copy.submit}
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        {copy.switchText}{" "}
        <Link href={copy.switchHref} className="font-medium text-zinc-900 underline dark:text-zinc-50">
          {copy.switchLink}
        </Link>
      </p>
    </main>
  );
}
