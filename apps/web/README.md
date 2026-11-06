# VERA web app

The full-stack Next.js app for VERA (Verified Escrow & Relief Architecture), a testnet proof-of-concept for milestone-gated escrow crowdfunding. The pages and the API routes (the backend) live in one app.

For what is built, what is next, and how everything fits together, read [`docs/PROGRESS_LOG.md`](../../docs/PROGRESS_LOG.md) and [`docs/CLAUDE.md`](../../docs/CLAUDE.md). The design source of truth is [`docs/VERA_MVP_SPDD.md`](../../docs/VERA_MVP_SPDD.md).

## What it does

- **Donors:** register with an email (a testnet wallet is created for you), see a live balance, and donate to campaigns. Donations are several on-chain steps; the page shows honest progress and never calls a donation complete until the chain confirms it. If a campaign passes its end date or goes quiet, anyone can close it and each donor claims their share back.
- **Organizers:** apply for verification, get approved by an admin, create campaigns with milestones, and publish each campaign to its own on-chain escrow vault. Each campaign has an end date and an inactivity period.
- **Attestors and the council:** an admin makes accounts attestors or council members. Attestors confirm that a milestone is done by choosing the evidence, hashed in the browser (the hash is what goes on-chain) and uploaded, so an admin/attestor/council viewer can later open exactly what was reviewed. Council members approve large payouts. The organizer, a council member or an admin then triggers the release. Everything is sent from the person's own wallet and counted by the contract.
- **Organizers (KYB):** the supporting document is likewise hashed and uploaded; an admin can open it from the admin console before approving.
- **Beneficiaries and payouts:** the organizer registers each beneficiary as a salted fingerprint (their real identity never reaches the server). An independent attestor who has met the person confirms they exist (again by fingerprint only, optionally with an evidence file). Once a milestone is released, the organizer can record a payout to a confirmed beneficiary: publicly visible on the campaign page. With the V2 contracts and `BENEFICIARY_REGISTRY_V2=1` the confirmation is also sent on-chain from the attestor's own wallet and the payout contract itself refuses an unconfirmed beneficiary.
- **Admins:** review organizer applications, appoint attestors and council members, change the council approval limit (applies to campaigns published afterwards) and the number of council approvals needed (applies at once; never below 2), and see every registered account and its email address at `/dashboard/admin/users` (admin only).
- **Everyone (no login):** browse campaigns and open a public audit page showing the money held in escrow, every donation, each milestone's confirmations, approvals, payouts to beneficiaries, and a check that the totals match the blockchain, with CSV/JSON download. A public **Chain activity** timeline lists every on-chain event with explorer links, and a **How VERA works** page explains the flow, who does what and the words used.

## Run it

From the repository root (Git Bash on Windows):

```bash
pnpm install
cp .env.example apps/web/.env.local    # then fill it in, see below
pnpm dev                               # http://localhost:3000
```

The local SQLite database (`apps/web/data/`, gitignored) is created and migrated automatically. Restart `pnpm dev` after changing `.env.local` or adding a migration.

### Configuration (`apps/web/.env.local`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file path, e.g. `./data/vera.db` |
| `AUTH_SECRET` | 32+ random characters; signs session cookies |
| `WALLET_ENCRYPTION_KEY` | 64 hex characters; encrypts generated wallet keys at rest |
| `MOCK_INR_ADDRESS` | The deployed MockINR token |
| `RPC_URL` | Polygon Amoy RPC; a comma-separated list is tried in order |
| `FACTORY_ADDRESS`, `INDEXER_START_BLOCK` | Turn on the event indexer (the Factory address and the block it was deployed in) |
| `FACTORY_OWNER_KEY` | Optional. The Factory owner and gas sponsor; turns on organizer on-chain sync, campaign publishing and donations. **A testnet key only; never commit it.** |
| `MILESTONE_MANAGER_ADDRESS`, `MANAGER_START_BLOCK` | Optional. The shared MilestoneManager and its deploy block (public values; Amoy: `0xe6d7222dDe3eE4b9688269427631aDF49229e747`, `47997230`). Turn on milestone registration, attestation, council approval and release, and let the indexer read releases. Sponsored actions need `FACTORY_OWNER_KEY` too. |
| `BENEFICIARY_REGISTRY_ADDRESS`, `REGISTRY_START_BLOCK` | Optional (public values; Amoy: `0xA4BF48D348246f66281B8Ca191F3981e15E5C54D`, `48161539`). Turns on beneficiary registration and the public unique-beneficiary count. |
| `BENEFICIARY_REGISTRY_V2`, `BENEFICIARY_REQUIRED_ATTESTATIONS` | Optional. Set `BENEFICIARY_REGISTRY_V2=1` only when the two addresses in this table point at `BeneficiaryRegistryV2` and `DisbursementV2` (Amoy: `0xF1C72cF2D5722a837305424D1966BBBe7F73454a`, start block `52128113`, and `0xba49F68CabB0389091B4767aedfFc90B182f7Bd2`, start block `52128142`); the attestor's confirmation is then also sent on-chain and only confirmed ones count. `BENEFICIARY_REQUIRED_ATTESTATIONS` (default 1) is how many distinct attestors must confirm a beneficiary before a payout is allowed, and must equal the V2 registry's constructor value. |
| `DISBURSEMENT_ADDRESS`, `DISBURSEMENT_START_BLOCK` | Optional, **deployed on Amoy** (`0x8305ECfbd9365efF27efD6f360C36589C006e5eA`, start block `48925371`). Turns on recording payouts to beneficiaries and the public Payouts section. |
| `PLATFORM_FEE_MINOR_UNITS`, `PLATFORM_FEE_ADDRESS` | Optional flat donation fee (default none) |

Generate the two secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Addresses are checksum-validated at startup. See [`.env.example`](../../.env.example) for the full list.

### Making an admin

There is deliberately no web route that grants admin. Register the account first, then:

```bash
pnpm --filter ./apps/web admin:promote you@example.com
```

## Scripts

```bash
pnpm dev         # development server
pnpm build       # production build
pnpm lint        # eslint
pnpm test        # vitest (497 pass, 6 opt-in live tests skipped)
pnpm typecheck   # tsc --noEmit
pnpm db:generate # create a SQL migration after editing lib/db/schema.ts
                 # (if pnpm's dependency check trips: npx drizzle-kit generate --name <x>)
```

## Layout

- `/how-it-works` is the public plain-words explanation and glossary (linked from the top bar and the footer)
- `/activity` is the public Chain activity timeline (all indexed on-chain events, filterable, with explorer links); API `GET /api/v1/activity`
- `app/` pages and `app/api/v1/` route handlers (`/dashboard` sends each role to its own workspace; `components/SiteNav.tsx` is the role-aware navigation and warns when another window of the same browser signs in as someone else)
- `components/` client components (forms, the live dashboard, donation progress) and shared layout pieces (`PageHead`, `StageRail`)
- `lib/` the logic, grouped by area: `auth`, `organizers`, `campaigns`, `indexer`, `donations`, `escrow` (attestation, council, release), `beneficiary`, `disbursement`, `expiry` (close and refund), `files` (uploaded KYB/evidence documents), `chain` (everything that touches the blockchain), `db`, `api`
- `drizzle/` forward-only SQL migrations

### Design

The UI is one designed mid-tone dark theme ("The Kept Ledger": warm charcoal and copper, Besley / Hanken Grotesk / Geist Mono). Read [`PRODUCT.md`](PRODUCT.md) (users, principles, constraints) and [`DESIGN.md`](DESIGN.md) (tokens, components, do's and don'ts) before changing any UI; tokens live in `app/globals.css`.

### Spending testnet POL

Every sponsored action (publishing, a new wallet's first action, releases) spends POL from the sponsor wallet, which is scarce. The app refuses sponsored actions when gas is above 150 gwei. `lib/escrow/live-amoy.test.ts` is an opt-in real-chain test (`LIVE_AMOY=1`, about 0.3-0.5 POL a run, 10-15 minutes: run it in the background with output redirected to a file, never with a shell timeout or a pipe); do not run it casually. `lib/disbursement/live-local.test.ts` covers the same kind of end-to-end proof for free, against a local anvil chain (`LIVE_LOCAL=1`) — always prefer it to prove a real-chain code path before ever running the Amoy version.

Next.js 16 ships its own documentation in `node_modules/next/dist/docs/`; check it before relying on older Next.js knowledge (for example `cookies()` and route `params` are async).
