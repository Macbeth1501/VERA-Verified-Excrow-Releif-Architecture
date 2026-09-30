# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary audience for the design right now (confirmed):** reviewers watching a demo, such as judges and mentors, who see the whole flow once, mostly on a laptop. They must be able to follow the story quickly: money is locked, independent people confirm the work, money is released in stages, and every step is public and checkable.

**Product users the flows serve (from the project docs):**
- **Donors:** ordinary people with no crypto knowledge, who give practice money on a test network and want proof it was used properly. Nothing is pre-selected for them, such as tips.
- **Campaign organizers:** verified organizations (a mock KYB check) that plan campaigns in milestones, request releases, register beneficiaries and record payouts.
- **Field attestors:** independent verifiers who confirm, with evidence, that a milestone is really done.
- **Governance council:** members who approve larger releases (above 100 mINR, three approvals).
- **Admin:** approves organizers and appoints attestors and council members.

## Product Purpose

VERA (Verified Escrow & Relief Architecture) is a testnet proof of concept for milestone-gated escrow crowdfunding and disaster relief. Donations sit in a public escrow and are released only in stages, after independent people confirm the work. Success means a viewer can see, without trusting the organizer, where every rupee is and why it moved.

## Positioning

Charity platforms are a black box: the money disappears at checkout. VERA's difference is that trust is enforced by structure, not promised: funds are never handed over up front, organizers cannot verify their own work, admin overhead is capped, the same person cannot be paid twice, and a live public ledger is checked against the blockchain on every refresh.

## Operating Context

- Runs on Polygon Amoy testnet. Money is "mINR" practice rupees (6 decimals); nothing has real value. Every page says so plainly.
- Anyone can open the public campaign pages and the Chain activity timeline without signing in.
- Each on-chain step links to the public block explorer (Polygonscan) so it can be checked independently.
- Signed-in roles each have their own workspace: donor account, organizer campaigns, attestor console, council console, admin console.
- All windows of one browser profile share a single sign-in; the top bar warns when another window signs in as someone else.
- The product is shown in demos and walkthroughs, mostly on a laptop.

## Capabilities and Constraints

- English only for now; desktop-first layouts (phones must not break, but are not the design target).
- Amounts are shown in rupees derived from chain data. An unreadable chain shows "unavailable", never zero. A fund figure is never invented or cached as truth.
- Pending is never shown as done. Data carries a "data as of block N" banner when the chain reader lags.
- Plain language for donors: no crypto jargon in the main flows (wallet details sit under "Advanced").
- Beneficiary identities are never shown or stored; only anonymous fingerprints exist.
- Pages are server-rendered Next.js (App Router); the public campaign page refreshes live while the tab is visible.
- Every page must be reachable by a click; a test enforces this.

## Brand Commitments

- The name is VERA (Verified Escrow & Relief Architecture).
- **Binding visual constraint (stated by the user):** the design must not feel like a generic AI-made dark website. Any redesign must avoid that look; the direction itself is decided later, not here.

## Evidence on Hand

- A live public ledger, real transactions on Polygon Amoy, and the Chain activity timeline, all backed by real chain data.
- No testimonials, customers, partner logos, press or logo files exist; do not fabricate them. `apps/web/public` holds only default framework icons.
- Project docs: `docs/Project_Overview.md` (the pitch), `docs/VERA_MVP_SPDD.md` (design source of truth), `docs/PROGRESS_LOG.md`.

## Product Principles

- **Show, don't claim:** every trust statement is backed by something a viewer can open and check.
- **Never pretend certainty:** pending, lagging, unavailable and unverified states are shown honestly.
- **Plain words for the people who are not experts:** the mechanism is explained without jargon.
- **No dark patterns:** nothing pre-selected, no hidden fees, no pressure.
- **Every role gets a workspace of its own,** and a stranger can still follow the whole story from the public pages.

## Accessibility & Inclusion

Target: WCAG 2.1 AA (confirmed): readable contrast, full keyboard use with visible focus, screen-reader labels, and respect for reduced-motion preferences.
