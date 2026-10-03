# VERA: Verified Escrow & Relief Architecture

A testnet proof-of-concept for **milestone-gated escrow crowdfunding and disaster relief**. Donors give to a campaign, but the money sits in a smart-contract vault. It leaves the vault only when independent attestors confirm a milestone is done (and, for large payouts, a council approves). Every donation, confirmation, release and payout is public and checked against the blockchain.

It runs on **Polygon Amoy** (testnet) with a mock rupee token (`mINR`). It is a $0-budget MVP: nothing here moves real money.

> **Status:** Steps 1-14 and the security/reconciliation hardening pass are built. The full chain (organizer approval, publish, donate, attest, council, release, beneficiary registration, payout, public reconciliation) has been verified live on Amoy and repeatedly on a local chain. See [`docs/PROGRESS_LOG.md`](docs/PROGRESS_LOG.md).

## How it works

1. An **organizer** is verified by an admin (mock KYB), then creates a campaign with milestones (percentages total 100) and publishes it. That deploys a dedicated escrow vault on-chain.
2. **Donors** register with an email (a wallet is generated for them) and donate. Practice funds are minted for them and the platform sponsors gas.
3. For each milestone, **attestors** confirm completion by submitting a hash of their evidence. The contract counts each attestor once; at the required number (at least 2) the milestone is *Verified*.
4. A release at or below the auto-release limit (100 mINR) needs only that. Above it, **council members** must also approve (3 approvals). Then the release moves the milestone's share to the organizer.
5. The organizer registers each **beneficiary** as a salted fingerprint made in the browser (no identity data reaches the server) and records **payouts** to them through the `Disbursement` contract.
6. Anyone can open the **public ledger** for a campaign: money held, released and paid out, every event with a Polygonscan link, and a reconciliation badge that is green only when the database, the vault and the token balance match exactly.

Plain-words version, with a glossary, lives in the running app at `/how-it-works`.

## Repository layout

| Path | What it is |
|---|---|
| `contracts/` | Foundry project (Solidity ^0.8.24, OpenZeppelin v5): `MockINR`, `CampaignFactory`, `CampaignVault`, `MilestoneManager`, `BeneficiaryRegistry`, `Disbursement` |
| `apps/web/` | Next.js 16 (App Router, React 19, Tailwind 4) full-stack app; the API routes are the backend. SQLite via Drizzle |
| `packages/types/` | `@vera/types`, shared TypeScript types |
| `docs/` | Design and project docs (below) |

### Documentation

| File | Contents |
|---|---|
| [`docs/manual_test.md`](docs/manual_test.md) | Run and test the whole app in your browser on a local chain, for free |
| [`docs/VERA_MVP_SPDD.md`](docs/VERA_MVP_SPDD.md) | Architecture, contracts and security (source of truth) |
| [`docs/VERA_MVP_Functional_Roadmap.md`](docs/VERA_MVP_Functional_Roadmap.md) | Requirements and business logic per module |
| [`docs/Technical_Details.md`](docs/Technical_Details.md), [`docs/Project_Overview.md`](docs/Project_Overview.md) | Technical and non-technical walkthroughs |
| [`docs/PROGRESS_LOG.md`](docs/PROGRESS_LOG.md) | What is done, deployed addresses, open items, gotchas |
| [`docs/mining_instructions.md`](docs/mining_instructions.md) | Topping up the gas-sponsor wallet with testnet POL |
| [`apps/web/PRODUCT.md`](apps/web/PRODUCT.md), [`apps/web/DESIGN.md`](apps/web/DESIGN.md) | Product principles and the visual design system |

## Quick start

Prerequisites: Node 20+, [pnpm](https://pnpm.io), [Foundry](https://book.getfoundry.sh/getting-started/installation). The commands assume Git Bash on Windows (Unix syntax).

```bash
pnpm install
```

### Try it locally, free (recommended)

The full guide is [`docs/manual_test.md`](docs/manual_test.md). In short: start a local chain with `anvil --chain-id 80002 --block-time 1`, deploy the five contracts, put their addresses in `apps/web/.env.development.local`, then run `pnpm dev` and open http://localhost:3000. No testnet funds or real keys are involved (anvil's dev keys are public and worth nothing).

### Run against Polygon Amoy

```bash
cp .env.example apps/web/.env.local     # fill it in; see apps/web/README.md for every variable
pnpm dev
```

You need an RPC URL, the deployed contract addresses (below), two generated secrets (`AUTH_SECRET`, `WALLET_ENCRYPTION_KEY`) and, to enable anything that sends a transaction, a funded testnet sponsor key as `FACTORY_OWNER_KEY` (testnet only, never commit it). Make an admin with `pnpm --filter ./apps/web admin:promote you@example.com`.

## Commands

```bash
pnpm dev         # Next.js dev server on http://localhost:3000
pnpm build       # production build
pnpm lint        # eslint
pnpm test        # forge test (contracts): 73 tests, fuzz at 10,000 runs
pnpm test:web    # vitest (web): 367 pass, 2 opt-in live tests skipped
pnpm --filter @vera/types typecheck
```

Two opt-in end-to-end tests drive the real routes against a real chain. Run them against a local anvil chain (free); the Amoy variant spends testnet POL. Details and exact commands are in `docs/manual_test.md` section 8.

## What costs testnet POL

Testnet POL from the Amoy faucet is scarce. On a **local anvil chain nothing costs POL**. On **Amoy**, every transaction is paid from the sponsor wallet (`FACTORY_OWNER_KEY`), including the gas top-ups for the wallets generated for organizers and donors, and that gas cannot be recovered.

| Action | On local anvil | On Amoy |
|---|---|---|
| Browsing, the public ledger, `/activity`, `/how-it-works` | Free | Free (read-only) |
| `pnpm test`, `pnpm test:web`, `tsc`, `eslint` | Free (simulated chains) | Free (they never touch Amoy) |
| `live-local.test.ts` (`LIVE_LOCAL=1`) | Free; refuses to run on anything but localhost | Not applicable |
| `live-amoy.test.ts` (`LIVE_AMOY=1`) | Free | **About 0.28-0.30 POL per run at 50 gwei**; refuses to start with under 1 POL; takes 2-25 minutes |
| Deploying a contract | Free | Costs POL, and a gas spike makes it far worse (one manager deploy cost 1.41 POL at 570 gwei). Check `cast gas-price` and pass `--gas-price` |
| Admin approves an organizer or grants an attestor/council role | Free | Costs POL (a transaction from the sponsor wallet) |
| Organizer publishes a campaign or registers milestones | Free | Costs POL, including a gas top-up for the organizer's wallet |
| A donor's first donation | Free | Roughly 0.03 POL sponsored gas (less afterwards) |
| Attest, council approval, release | Free | Costs POL each (sponsored gas) |
| Register a beneficiary, record a payout | Free | Costs POL each (sponsored gas) |

The app refuses sponsored actions when gas is above 150 gwei, so a spike cannot drain the wallet. Before any Amoy spend, check the sponsor balance with `cast balance` and the gas price with `cast gas-price`. To top up, see [`docs/mining_instructions.md`](docs/mining_instructions.md). To prove a real-chain code path, use a local chain first ([`docs/manual_test.md`](docs/manual_test.md)).

## Deployed on Polygon Amoy (chain id 80002)

| Contract | Address |
|---|---|
| MockINR | `0x9b6f00a1ce627a3e0d2da601253704084d8fc52c` |
| CampaignFactory | `0x6931E776da5db1D9e5890407FE268705D70740bD` |
| MilestoneManager | `0xe6d7222dDe3eE4b9688269427631aDF49229e747` |
| BeneficiaryRegistry | `0xA4BF48D348246f66281B8Ca191F3981e15E5C54D` |
| Disbursement | `0x8305ECfbd9365efF27efD6f360C36589C006e5eA` |

View them on [amoy.polygonscan.com](https://amoy.polygonscan.com). Factory campaigns #0-#3 predate the real manager and are demo-only.

## Security notes

- The contracts were reviewed with Slither across the whole tree: 4 informational/low findings, 0 medium/high (details in the progress log). Money-moving functions follow checks-effects-interactions and are `nonReentrant`.
- Funds leave a vault only through `MilestoneManager`, whose address is immutable in the vault; organizers have no transfer privilege.
- Beneficiary identities are never sent to the server or written on-chain, only salted hashes.
- This is a testnet MVP. KYB is mocked, there is no wallet-signature login (own-wallet addresses are stored unverified), and it has not had an external audit. Do not use it with real funds.
- Never commit private keys. Wallet material belongs in gitignored files only.

## Contributing and workflow notes

The project is built one step at a time against the SPDD. If you change contract behaviour, update the docs in the same change and record any divergence from the SPDD in `docs/PROGRESS_LOG.md` rather than editing the SPDD.
