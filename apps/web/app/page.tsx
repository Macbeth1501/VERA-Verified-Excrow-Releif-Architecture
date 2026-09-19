import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">VERA</h1>
      <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
        Verified Escrow and Relief Architecture. Donations are held in escrow and released only after independent
        people confirm the work was done.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/campaigns"
          className="rounded-md border border-zinc-300 px-5 py-2.5 font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Browse campaigns
        </Link>
        <Link
          href="/register"
          className="rounded-md bg-zinc-900 px-5 py-2.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-zinc-300 px-5 py-2.5 font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Sign in
        </Link>
      </div>
      <p className="mt-6 text-sm text-zinc-500">This is a testnet demo. No real money is involved.</p>
    </main>
  );
}
