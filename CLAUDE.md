# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VERA (Verified Escrow & Relief Architecture) MVP: a $0-budget testnet proof-of-concept for milestone-gated escrow crowdfunding and disaster relief, on Polygon Amoy. Source-of-truth docs live in `docs/`:
- `VERA_MVP_SPDD.md` — architecture, contracts, security. Single source of truth; code comments cite its sections (e.g. "SPDD §18.2"). Do not edit it to match the code; record divergences in the progress log instead.
- `VERA_MVP_Functional_Roadmap.md` — FR-IDs and business logic per module.
- `PROGRESS_LOG.md` — live log of what is done, the current next step, deployed addresses, open items, and gotchas. **Start here** to see where the project stands.
- `mining_instructions.md` — how to top up the deployer/gas-sponsor wallet with testnet POL.
- `manual_test.md` — zero-POL, from-scratch browser test of the whole app on a local anvil chain (deploy, `.env.development.local`, 8 accounts, full walkthrough, reset).

Roadmap step numbers are **not sequential**. Steps 1-12 are built (Step 4 `MilestoneManager` deployed; Steps 11-12 attestation and council approval built, live verification incomplete, see the log). Check `docs/PROGRESS_LOG.md` and SPDD §16 for what comes next (Step 13 beneficiaries or Step 14 disbursement) instead of assuming. The working agreement is to build one (sub-)step at a time and not generate code ahead of the current step.

## Layout (pnpm workspace: `apps/*`, `contracts`, `packages/*`, `indexer`)

- `contracts/` — Foundry project (Solidity ^0.8.24, OpenZeppelin v5). `lib/` (forge-std, openzeppelin-contracts) is checked in as plain files, not submodules.
- `apps/web/` — Next.js 16 App Router, React 19, Tailwind 4, one full-stack app (API routes are the backend). See "Web app architecture" below. Next 16 ships its own docs in `node_modules/next/dist/docs/`; check them, as APIs differ from older Next versions (e.g. `cookies()` and route `params` are async).
- `packages/types/` — `@vera/types`, shared TS types mirroring the SPDD §11.2 ER diagram. Source-only (`main: src/index.ts`, no build step). Descriptive data only: fund figures (balances, totals) are deliberately excluded because they must come from the chain.
- `indexer/` — an empty leftover directory with no `package.json`. The indexer was built inside the web app instead (`apps/web/lib/indexer`).

## Commands

Run from the repo root unless noted. Wrong working directory has been a recurring source of errors; docs assume Git Bash on Windows (Unix syntax).

```
pnpm dev        # next dev (apps/web), http://localhost:3000
pnpm build      # next build
pnpm lint       # eslint (apps/web)
pnpm test       # forge test (contracts)
pnpm test:web   # vitest (apps/web)
pnpm --filter @vera/types typecheck    # tsc --noEmit on shared types
pnpm --filter ./apps/web admin:promote <email> [--demote]   # the only way to make an admin
```

From `apps/web/`: `pnpm test` (one file: `npx vitest run lib/auth/crypto.test.ts`), `pnpm typecheck`, `pnpm db:generate` (drizzle-kit: create a SQL migration after editing `lib/db/schema.ts`; migrations apply automatically when the DB is first opened). **Restart `pnpm dev` after adding a migration or changing `.env.local`:** the dev server caches its DB connection and env.

From `contracts/`:
```
forge build
forge test
forge test --match-contract CampaignFactoryTest       # one test contract
forge test --match-test testFuzz_ -vvv                # by test name
forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast
```
`contracts/foundry.toml` sets fuzz runs to 10,000 per SPDD §21.

## Environment variables (see `.env.example`)

- **Contracts** read `contracts/.env`: `RPC_URL`, `DEPLOYER_PRIVATE_KEY`.
- **Web app** reads `apps/web/.env.local`, validated lazily in `apps/web/lib/env.ts` (every address is checksum-validated, so a typo fails at startup rather than mid-transaction):
  - Required: `DATABASE_URL` (SQLite path), `AUTH_SECRET` (32+ chars), `WALLET_ENCRYPTION_KEY` (64 hex chars), `MOCK_INR_ADDRESS`.
  - `RPC_URL` may be a comma-separated list, used as ordered fallbacks. The official `rpc-amoy.polygon.technology` has been unreachable from the dev machine; dRPC, PublicNode and Tenderly work (dRPC's free tier times out on wide `getLogs` ranges).
  - Indexer: `FACTORY_ADDRESS` and `INDEXER_START_BLOCK` (Factory deploy block 47969967); optional `INDEXER_CONFIRMATIONS` (2) and `INDEXER_MAX_RANGE` (2000).
  - `FACTORY_OWNER_KEY` (the Factory owner, also the gas sponsor) switches on organizer on-chain sync, campaign publishing and donations. It controls the Factory: testnet key, gitignored file only. Without it those features report "not configured"/"switched off".
  - `MILESTONE_MANAGER_ADDRESS` and `MANAGER_START_BLOCK` (47997230) switch on milestone registration, attestation, council approval and release, and let the indexer read releases. `FACTORY_OWNER_KEY` is also the manager's owner (role changes) and pays every sponsored action; sponsored actions refuse to run above 150 gwei (`gasPriceRefusal` in `lib/chain/sponsor.ts`), because a gas spike can drain the wallet.
  - Donation fee: `PLATFORM_FEE_MINOR_UNITS` (default 0) and `PLATFORM_FEE_ADDRESS` (required when a fee is set).

## Contract architecture

- `MockINR` (`mINR`) — mock rupee stablecoin, open `mint`, deliberately 6 decimals. It replaced the earlier `MockUSDC` name; never reintroduce USDC naming.
- `CampaignFactory` (Ownable) — on-chain registry of verified organizers (`setOrganizerVerified`) and per-category admin-cap ceilings in whole percent (10/15/20). `createCampaign` enforces, non-bypassably: organizer verified, `adminCapPct <= ceiling`, milestone `targetPct`s sum to exactly 100, and a configured milestone manager. It deploys one `CampaignVault` per campaign and records a `CampaignRecord`. Its `CampaignCategory` enum mirrors `@vera/types`; keep the two in sync. `msg.sender` becomes the campaign's organizer, so the organizer's own wallet must send the transaction.
- `CampaignVault` — per-campaign escrow holding mINR. Funds leave only via `releaseForMilestone`, gated by `onlyMilestoneManager`. The manager is a constructor-immutable with no setter, so nobody can claim release rights later. Organizers have no transfer privilege. Optional disclosed `pause`/`unpause` (organizer-gated with a string revert, versus a compliance role in SPDD §18.2). **`releaseForMilestone` emits no event,** so releases cannot be indexed; `MilestoneManager` must emit them, and then `vaultTotals` must subtract releases.
- `MilestoneManager` — **one shared contract for every vault** (deployed, Amoy `0xe6d7222dDe3eE4b9688269427631aDF49229e747`, block 47997230, owner = the deployer/sponsor wallet). The vault's organizer registers milestones (`defineMilestone`, percentages total at most 100, at least **2** confirmations each so no single attestor can verify). Global owner-curated attestors `submitAttestation(vault, index, proofHash)` (once each, never the organizer); at M the milestone is Verified. `release(vault, index)` is permissionless once milestones total 100, go in order and are Verified; above the auto-release limit (100 mINR, snapshotted per milestone) it also needs `councilThreshold` (3) council approvals. It pays the cumulative share of everything raised minus what was released, **to the vault's organizer**. Emits `MilestoneDefined/Attested/Verified`, `CouncilApproved`, `MilestoneReleased`; the last is the only record of a release, since the vault emits nothing. Slither: 0 findings.
- Tests in `contracts/test/` include deposit fuzz tests. `Deploy.s.sol` deploys MockINR and CampaignFactory, with an optional `MILESTONE_MANAGER` env var.

Deployment (Polygon Amoy, 80002): MockINR `0x9b6f00a1ce627a3e0d2da601253704084d8fc52c`, CampaignFactory `0x6931E776da5db1D9e5890407FE268705D70740bD`, MilestoneManager above (set on the Factory). Factory campaigns #0-#3 were created while the manager was a **placeholder** (the deployer wallet), so they are demo-only forever; only campaigns published after 2026-09-19 use the real manager. The Factory registry also contains several throwaway verified organizers. The original `forge script` broadcast only landed MockINR, so the Factory was deployed with `forge create` (put `--constructor-args` last: it is variadic). **Before any deploy check `cast gas-price` and pass `--gas-price`:** Amoy spiked to 570 gwei once and a plain `forge create` of the manager cost 1.41 POL. Full record in `docs/PROGRESS_LOG.md`.

OpenZeppelin v5 gotcha: `Ownable` requires an explicit initial owner (`Ownable(msg.sender)`). `git mv` doesn't change file contents, so after renaming a contract also rewrite its declaration and imports.

## Web app architecture (`apps/web`)

**Conventions that hold everywhere**
- **Route handlers are thin;** logic lives in `lib/<area>/service.ts`. Tests call the exported route handlers directly against an in-memory DB (`DATABASE_URL=:memory:`, `resetDbForTests`) and mock only the chain module.
- **Authorization reads the role from the database on every request** (`lib/api/guards.ts` `requireUser(request, ...roles)`), never from the session token, so an approved organizer or new admin works immediately with an old cookie.
- **Errors** use the SPDD §12.3 envelope (`lib/api/errors.ts`, specific codes, never a bare 500). Mutating routes use the in-memory token bucket in `lib/api/rate-limit.ts`.
- **Money is never a float and is never stored.** Amounts are integer mINR minor units (6 decimals) in strings; `lib/campaigns/money.ts` converts. Totals and balances are derived from chain events or read from the chain; an unreadable chain shows "unavailable", never zero.
- **Every chain operation is wrapped so it never throws** and returns a result to record and retry; the database decision or record is saved first, so a chain failure never loses it.
- **DB:** SQLite via Drizzle (`lib/db`), cached on `globalThis`. Tables: `users`, `organizer_profiles`, `campaigns`, `milestones`, `chain_events`, `indexer_cursors`, `donations`, `role_grants`, `milestone_actions`. Migrations are forward-only in `apps/web/drizzle` (run `npx drizzle-kit generate --name <x>` from `apps/web` if `pnpm db:generate` trips over pnpm's dependency check).

**Auth and wallets (Step 5, FR-IDN-01).** `lib/auth/`: `users.ts` (register/authenticate), `session.ts` (24 h HS256 JWT in an HttpOnly cookie via `jose`), `crypto.ts` (email hash for duplicate detection, AES-256-GCM for wallet keys), bcrypt passwords (min 12 chars; a cheap cost only when `NODE_ENV=test`). New users get a generated wallet (`lib/chain/wallet.ts`) whose key is stored encrypted and never returned by any API. An optional own-wallet address is stored **unverified** (no SIWE) and cannot be signed for, so those users cannot publish campaigns or donate.

**Organizer KYB (Step 6, FR-IDN-02).** `lib/organizers/service.ts`: `pending` -> `verified`/`rejected` (a rejected organizer may resubmit); approval promotes `users.role` to `organizer`. `requireVerifiedOrganizer` is the gate every campaign-creating route calls. The applicant's document is hashed in the browser and only the hash is stored. `lib/chain/factory.ts` mirrors an approval to `CampaignFactory.setOrganizerVerified` (idempotent, result in `organizer_profiles.chain_sync`, retryable from the admin console). Admins exist only via `admin:promote`; there is no web route that grants admin.

**Campaigns (Step 7, FR-CMP-01).** `lib/campaigns/validation.ts` is one zod schema shared by browser and API (milestones total exactly 100, admin cap <= ceiling); `ceilings.ts` (10/15/20) **must match `CampaignFactory.categoryAdminCeilingPct`**. A campaign is saved `DRAFT` with a null vault; `POST /api/v1/campaigns/:id/deploy` (idempotent, retryable) then calls `lib/chain/campaigns.ts`, which **signs as the organizer, never the caller** (the Factory records `msg.sender`; an admin retrying must still produce the organizer's campaign), topping the organizer's wallet up with POL from the sponsor first.

**Sponsor wallet.** `lib/chain/sponsor.ts` funds gas for organizer and donor wallets (generated wallets start with no POL) and serialises the sponsor's sends so concurrent top-ups cannot race for a nonce.

**Indexer (Step 8, `lib/indexer/`).** The app reads `CampaignCreated` and `DonationReceived` directly from the chain into `chain_events` (append-only, id `txHash:logIndex`). Only `lib/indexer` writes it. `sync.ts` takes a `ChainReader` (`types.ts`), so it is tested with `fake-chain.ts`; the real reader is `lib/chain/reader.ts`. It chunks reads, halves a chunk when an RPC refuses the range, advances a cursor only after events are stored, and reads only blocks 2 confirmations deep. `runtime.ts` `syncIfStale` (10 s window, shared in-flight pass) refreshes on read; there is no background worker. Off unless `FACTORY_ADDRESS` and `INDEXER_START_BLOCK` are set. Routes: `/api/v1/indexer/{status,reconcile,sync}`. Reconciliation compares the indexed total with the vault's `getBalance()` and the token balance at the same block, zero tolerance.

**Public dashboard (Step 9, FR-LDG-01).** `lib/campaigns/dashboard.ts` `buildDashboard` is the single source for what the public sees; the page `app/campaigns/[id]/page.tsx` (server, `force-dynamic`), `GET /api/v1/campaigns/:id/ledger` and `/export?format=csv|json` all use it, so they cannot disagree. `components/LedgerDashboard.tsx` is the client view (polls every 10 s while the tab is visible). The "data as of block N" banner goes amber past `LAG_WARNING_BLOCKS` (60); the reconciliation badge is green only on an exact three-way match. `formatUtc` is hand-written (not `Intl`) so server and browser text cannot differ. There is no automated browser test; the live refresh was checked by hand over Chrome DevTools.

**Donations (Step 10, FR-CMP-02; `lib/donations/`, `lib/chain/donations.ts`).** A resumable state machine, not one long request. `POST /api/v1/donations` records a PENDING donation; the browser calls `POST /donations/:id/advance` about every 1.5 s and each call sends ONE step (`gas`, `mint`, `fee` only if a fee applies, `approve`, `deposit`), **saving the tx hash before waiting**, under an atomic lock (`locked_until`) so a step never runs twice. A donation is CONFIRMED only after the deposit receipt is read and its `DonationReceived` event (vault, donor, amount) is verified. **An error while checking an already-sent transaction must leave it PENDING, never FAILED.** `advance.ts` is the engine and depends only on the `DonationChain` port (`chain-port.ts`), so it is tested with `fake-chain.ts`. Every transaction is sent from the donor's own generated wallet; the platform only sponsors gas. The fee is flat, 0 by default, paid on top, and when configured must be an explicit, never pre-selected choice.

**Escrow: attestation, council, release (Steps 11-12; `lib/escrow/`, `lib/chain/manager.ts`).** The contract decides everything that matters; the app records who asked for what and reads state back. `chain-port.ts` is the `EscrowChain` port (real: `lib/chain/manager.ts`, which simulates first so the contract's own custom error becomes a plain sentence, and funds each call from its own gas estimate; fake: `fake-chain.ts`, which mirrors the contract's rules). `service.ts`: `setRole` (admin makes attestors/council; DB first then contract, **revocation contract first**; organizers/admins cannot hold either role), `defineMilestonesOnChain` (signed as the organizer, adopts definitions already on-chain, so it is safe to repeat), `performAction` (one `milestone_actions` row per milestone/kind/actor; **hash saved before waiting; an unknown outcome stays PENDING**; a FAILED row is reused on retry). `attestationCollector.ts` and `councilWorkflow.ts` hold the flows; routes are `admin/roles`, `campaigns/:id/milestones/define`, `milestones/:id` (public state) and `/attestations`, `/council-approval`, `/release`. Attestations carry only a hash of evidence computed in the browser. Milestone status is read from the contract, never stored; the public dashboard counts events from the indexer's `manager` stream (`MANAGER_START_BLOCK`). `live-amoy.test.ts` is an **opt-in real-chain test** (`LIVE_AMOY=1`, about 0.5 POL per run, refuses to start under 1 POL).

**Pages.** Public: `/`, `/campaigns`, `/campaigns/[id]` (dashboard + donate panel), `/organizers/[id]`, `/register`, `/login`. Signed in: `/account` (balance, "Your donations", role console link), `/donations/[id]` (receipt / resume), `/dashboard/organizer` (apply, status), `/dashboard/campaigns[/new|/[id]]` (milestone registration and release), `/dashboard/attestor`, `/dashboard/council`, and admin-only `/dashboard/admin` (organizer applications and the attestor/council role manager).

## Gotchas

- **Shell escaping:** backslash sequences (carriage-return plus line-feed) inside heredocs, `sed` and Python string literals repeatedly became real line breaks and broke a test file. Build such strings with `chr(92)` in Python, or avoid them.
- **The Bash tool fails with "unexpected EOF" on one very large command** (roughly over 8 KB, e.g. several files in one heredoc chain) and runs nothing; write files in separate smaller commands.
- A stale `tsconfig.tsbuildinfo` can keep reporting fixed type errors; delete it and rerun `tsc`.
- When driving the UI in a real browser (Chrome DevTools), wait for React hydration before typing, or the input is overwritten.

## Progress log rule (important)

`docs/PROGRESS_LOG.md` must stay live. After every completed step or sub-step (code change, deployment, doc correction), update it in the same turn, before reporting the step as done: refresh "Current status", "Next step" and the deployed addresses, and add a dated entry to "History". If the log and the code disagree, fix the log.

## Knowledge graph (graphify)

A graphify knowledge graph lives in `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`, `graph.html`). Consult it for architecture questions (`/graphify query "<question>"`) before grepping broadly. `.graphifyignore` excludes vendored `contracts/lib/`, `apps/web/public/`, and `docs/Main Wallet.txt` (wallet material, never read or extract it).

Keep the graph current after changing code or docs:
```
graphify update .          # re-extract only new/changed files (CLI, run from repo root)
/graphify . --update       # same, as a Claude Code slash command (needed when docs changed and need LLM extraction)
```
Run an update after meaningful edits, and before answering questions from a graph that may be stale. Note graphify does not parse `.sol` files, so contract changes only reach the graph through docs and `CLAUDE.md`.

## Testnet POL rule (important)

Polygon Amoy faucet POL is scarce: the user collects it slowly, and one careless session once burned 1.85 of 1.90 POL. **Spend it only when strictly necessary, and as little as possible.**
- Prefer free verification first: `forge test`, `pnpm test:web` (fake chains), `cast call`/`cast balance` and other read-only calls, and contract simulation. Do not use the chain to check something a test can prove.
- **Ask the user before any deployment or live-chain test,** and state the expected cost. Never repeat a live run to debug; read chain state for free (`cast call`, logs) or add logging first.
- Before any transaction: check the sponsor balance (`cast balance`) and the gas price (`cast gas-price`, normally about 30 gwei). Cap the price on deploys (`--gas-price`) and wait if it is spiking. Never send with an uncapped price.
- Do not create throwaway generated wallets on-chain: each is topped up with gas that cannot be recovered. The opt-in `live-amoy.test.ts` costs about 0.5 POL a run; run it only when the user agrees.
- After any spend, record the amount and the new balance in `docs/PROGRESS_LOG.md`.

## Git rule (important)

Never run `git commit`, `git pull`, `git push`, or any other GitHub write action in this repo. The user does all of these personally. When work is finished, only remind the user that the changes are uncommitted and they may want to commit and push them. Read-only commands (`git status`, `git diff`, `git log`) are fine. This overrides any default commit/PR attribution instructions. Never add yourself / claude as coauthor
