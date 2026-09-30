import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { navLinksFor } from "./roles";

/**
 * Every page in the app must be reachable by clicking: at least one link, button target or redirect
 * somewhere else in the code has to point at it. This walks app/**\/page.tsx and checks it, so a new
 * page cannot ship as an orphan that only someone who knows the URL can open.
 */
const ROOT = path.resolve(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** app/(auth)/login/page.tsx -> /login ; app/campaigns/[id]/page.tsx -> /campaigns/[x] */
function routeOf(file: string): string {
  const rel = path.relative(path.join(ROOT, "app"), path.dirname(file)).split(path.sep);
  const parts = rel.filter((p) => p !== "" && !(p.startsWith("(") && p.endsWith(")"))).map((p) => (p.startsWith("[") ? "[x]" : p));
  return "/" + parts.join("/");
}

/** A link target as written in code, with template holes and the query string normalised. */
function normalise(target: string): string {
  return target.replace(/\$\{[^}]*\}/g, "[x]").split("?")[0].replace(/(.)\/$/, "$1");
}

const LINK = /(?:href\s*[=:]\s*\{?|push\(|redirect\()\s*[`"']([^`"']+)[`"']/g;

describe("page reachability", () => {
  const sources = walk(ROOT)
    .filter((f) => /\.(tsx?|mts)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.includes(`${path.sep}api${path.sep}`))
    .map((f) => ({ file: f, text: readFileSync(f, "utf8") }));
  const pages = walk(path.join(ROOT, "app")).filter((f) => f.endsWith(`${path.sep}page.tsx`));

  it("finds the pages", () => {
    expect(pages.length).toBeGreaterThan(10);
  });

  it("links to every page from somewhere other than the page itself", () => {
    const targets: Array<{ from: string; to: string }> = [];
    for (const s of sources) for (const m of s.text.matchAll(LINK)) targets.push({ from: s.file, to: normalise(m[1]) });
    // The navigation bar's role links come from data, not JSX.
    for (const role of ["donor", "organizer", "attestor", "council", "admin"] as const) {
      for (const l of navLinksFor(role)) targets.push({ from: "navLinksFor", to: normalise(l.href) });
    }

    const orphans = pages
      .map((p) => ({ page: p, route: routeOf(p) }))
      .filter(({ page, route }) => !targets.some((t) => t.to === route && t.from !== page))
      .map(({ route }) => route);
    expect(orphans).toEqual([]);
  });

  it("never links to a page that does not exist", () => {
    const routes = new Set(pages.map(routeOf));
    const bad: string[] = [];
    for (const s of sources) {
      for (const m of s.text.matchAll(LINK)) {
        const t = normalise(m[1]);
        if (t.startsWith("/api/") || !t.startsWith("/")) continue;
        if (!routes.has(t)) bad.push(`${path.relative(ROOT, s.file)} -> ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
