import type { Metadata } from "next";
import { Besley, Geist_Mono, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";

const besley = Besley({
  variable: "--font-besley",
  subsets: ["latin"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VERA | Verified Escrow and Relief Architecture",
  description: "Milestone-gated escrow crowdfunding and disaster relief (testnet demo).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${besley.variable} ${hanken.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#content"
          className="absolute left-4 top-2 z-50 -translate-y-24 rounded-md bg-copper px-4 py-2 text-sm font-semibold text-on-copper focus:translate-y-0"
        >
          Skip to main content
        </a>
        <SiteNav />
        <div id="content" tabIndex={-1} className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 outline-none">
          {children}
        </div>
        <footer className="mt-16 border-t border-rule bg-well">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-6 py-5 text-sm text-dim">
            <p>A testnet demonstration. Practice money only; every transaction shown is real and public.</p>
            <nav aria-label="Footer" className="flex gap-x-6">
              <Link href="/how-it-works" className="inline-flex min-h-8 items-center text-sand hover:text-ink">
                How VERA works
              </Link>
              <Link href="/campaigns" className="inline-flex min-h-8 items-center text-sand hover:text-ink">
                Campaigns
              </Link>
              <Link href="/activity" className="inline-flex min-h-8 items-center text-sand hover:text-ink">
                Chain activity
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
