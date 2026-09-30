# VERA web app

The full-stack Next.js app for VERA (Verified Escrow & Relief Architecture), a testnet proof-of-concept for milestone-gated escrow crowdfunding. The pages and the API routes (the backend) live in one app.

For what is built, what is next, and how everything fits together, read [`docs/PROGRESS_LOG.md`](../../docs/PROGRESS_LOG.md) and [`CLAUDE.md`](../../CLAUDE.md) at the repository root. The design source of truth is [`docs/VERA_MVP_SPDD.md`](../../docs/VERA_MVP_SPDD.md).

## What it does

- **Donors:** register with an email (a testnet wallet is created for you), see a live balance, and donate to campaigns. Donations are several on-chain steps; the page shows honest progress and never calls a donation complete until the chain confirms it.
- **Organizers:** apply for verification, get approved by an admin, create campaigns with milestones, and publish each campaign to its own on-chain escrow vault.
- **Attestors and the council:** an admin makes accounts attestors or council members. Attestors confirm that a milestone is done by choosing the evidence, hashed in the browser (the hash is what goes on-chain) and uploaded, so an admin/attestor/council viewer can later open exactly what was reviewed. Council members approve large payouts. The organizer, a council member or an admin then triggers the release. Everything is sent from the person's own wallet and counted by the contract.
- **Organizers (KYB):** the supporting document is likewise hashed and uploaded; an admin can open it from the admin console before approving.
- **Beneficiaries and payouts:** the organizer registers each beneficiary as a salted fingerprint (their real identity never reaches the server), and, once a milestone is released, records a payout to one of them — publicly visible on the campaign page.
- **Everyone (no login):** browse campaigns and open a public audit page showing the money held in escrow, every donation, each milestone's confirmations, approvals, payouts to beneficiaries, and a check that the totals match the blockchain, with CSV/JSON download.

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
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm db:generate # create a SQL migration after editing lib/db/schema.ts
                 # (if pnpm's dependency check trips: npx drizzle-kit generate --name <x>)
```

## Layout

- `app/` pages and `app/api/v1/` route handlers (`/dashboard` sends each role to its own workspace; `components/SiteNav.tsx` is the role-aware navigation and warns when another window of the same browser signs in as someone else)
- `components/` client components (forms, the live dashboard, donation progress)
- `lib/` the logic, grouped by area: `auth`, `organizers`, `campaigns`, `indexer`, `donations`, `escrow` (attestation, council, release), `beneficiary`, `disbursement`, `files` (uploaded KYB/evidence documents), `chain` (everything that touches the blockchain), `db`, `api`
- `drizzle/` forward-only SQL migrations

### Spending testnet POL

Every sponsored action (publishing, a new wallet's first action, releases) spends POL from the sponsor wallet, which is scarce. The app refuses sponsored actions when gas is above 150 gwei. `lib/escrow/live-amoy.test.ts` is an opt-in real-chain test (`LIVE_AMOY=1`, about 0.3-0.5 POL a run, 10-15 minutes: run it in the background with output redirected to a file, never with a shell timeout or a pipe); do not run it casually. `lib/disbursement/live-local.test.ts` covers the same kind of end-to-end proof for free, against a local anvil chain (`LIVE_LOCAL=1`) — always prefer it to prove a real-chain code path before ever running the Amoy version.

Next.js 16 ships its own documentation in `node_modules/next/dist/docs/`; check it before relying on older Next.js knowledge (for example `cookies()` and route `params` are async).
