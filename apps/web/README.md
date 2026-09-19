# VERA web app

The full-stack Next.js app for VERA (Verified Escrow & Relief Architecture), a testnet proof-of-concept for milestone-gated escrow crowdfunding. The pages and the API routes (the backend) live in one app.

For what is built, what is next, and how everything fits together, read [`docs/PROGRESS_LOG.md`](../../docs/PROGRESS_LOG.md) and [`CLAUDE.md`](../../CLAUDE.md) at the repository root. The design source of truth is [`docs/VERA_MVP_SPDD.md`](../../docs/VERA_MVP_SPDD.md).

## What it does

- **Donors:** register with an email (a testnet wallet is created for you), see a live balance, and donate to campaigns. Donations are several on-chain steps; the page shows honest progress and never calls a donation complete until the chain confirms it.
- **Organizers:** apply for verification, get approved by an admin, create campaigns with milestones, and publish each campaign to its own on-chain escrow vault.
- **Attestors and the council:** an admin makes accounts attestors or council members. Attestors confirm that a milestone is done by choosing the evidence (hashed in the browser; the file never leaves it). Council members approve large payouts. The organizer, a council member or an admin then triggers the release. Everything is sent from the person's own wallet and counted by the contract.
- **Everyone (no login):** browse campaigns and open a public audit page showing the money held in escrow, every donation, each milestone's confirmations, approvals and payouts, and a check that the totals match the blockchain, with CSV/JSON download.

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

- `app/` pages and `app/api/v1/` route handlers
- `components/` client components (forms, the live dashboard, donation progress)
- `lib/` the logic, grouped by area: `auth`, `organizers`, `campaigns`, `indexer`, `donations`, `escrow` (attestation, council, release), `chain` (everything that touches the blockchain), `db`, `api`
- `drizzle/` forward-only SQL migrations

### Spending testnet POL

Every sponsored action (publishing, a new wallet's first action, releases) spends POL from the sponsor wallet, which is scarce. The app refuses sponsored actions when gas is above 150 gwei. `lib/escrow/live-amoy.test.ts` is an opt-in real-chain test (`LIVE_AMOY=1`, about 0.5 POL a run); do not run it casually.

Next.js 16 ships its own documentation in `node_modules/next/dist/docs/`; check it before relying on older Next.js knowledge (for example `cookies()` and route `params` are async).
