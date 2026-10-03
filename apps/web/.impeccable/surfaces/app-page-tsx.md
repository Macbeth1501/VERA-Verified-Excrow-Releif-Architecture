---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["components/LedgerDashboard.tsx","app/globals.css"]
---

# Surface brief: VERA public surfaces and shared foundation

Scope: home, campaigns list, campaign page, Chain activity, organizer profile, login, register, plus the shared theme, type, grid and navigation used by every page. Visitor mode: Persuade on the home page (a reviewer must grasp the mechanism fast), Operate and Read elsewhere. Audience: reviewers watching a demo, on a laptop, in English, WCAG AA. Constraints: PRODUCT.md (mid-tone dark, not a generic AI dark site, honest chain states, no invented claims). Build path: code-led.

## Direction contract

THESIS: The public ledger as a kept account book. Money's journey is shown as a four-stage rail (locked, confirmed, released, paid out) and every campaign reads like a statement of account with ruled lines, not a dashboard of cards. Refuses the hero-metric template, card grids and boxed everything.

OWN-WORLD: Warm charcoal ground (#3a332f) with a slightly raised panel (#453d38) and sunken well (#2f2926); cream ink (#f1e7da), muted sand text (#c9bcab), ruled hairlines (#5a5049). Copper (#e9a46f) is the single voice: stage markers, primary buttons, links. Status hues (moss #7fcf9c, brass #e6c15c, rose #f2848c) appear only as state. Type: Besley for headings and money (a ledger-print serif), Hanken Grotesk for reading, Geist Mono for hashes and tabular numerals. Ruled rows and dividers instead of boxes; one rail motif reused on home, milestones and activity. Icons authored as inline SVG in one stroke weight.

STORY: In ten seconds a reviewer understands: donations are locked in a public escrow, released only after independent people confirm the work, and every step is checkable. They believe it because the numbers reconcile against the chain in a visible seal, and they act by opening a campaign or the chain activity.

FIRST VIEWPORT: Home, at 1280 wide, shared 1152px grid. Left (7 cols): a large Besley statement of the mechanism, one supporting sentence, one copper primary button (Browse campaigns) and one quiet text link (Chain activity). Right (5 cols): the four-stage rail drawn vertically as a ruled ledger with live totals for donated, released and paid out when the indexer has data (otherwise the stage descriptions alone). Campaign page: title and organizer, a reconciliation seal beside the title, then a left statement of account (donated, released, paid to beneficiaries, still held) with a plain goal line, and a right column with the donate panel and the milestone rail.

FORM: user-pinned direction (warm charcoal and copper, ledger). Roll skipped by the brief's authority; seed key: none (pinned).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved decisions
- Motion: one authored moment (the rail line drawing in), decided during build.
- Donor, organizer and console pages inherit the theme and grid now; their layouts get their own critique afterwards.
