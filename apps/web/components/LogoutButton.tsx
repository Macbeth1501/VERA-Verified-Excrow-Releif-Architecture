"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/v1/auth/logout", { method: "POST" });
        window.dispatchEvent(new Event("vera:auth-changed"));
        router.push("/");
        router.refresh();
      }}
      className="inline-flex min-h-8 items-center text-sm font-medium text-sand underline hover:text-ink"
    >
      Sign out
    </button>
  );
}
