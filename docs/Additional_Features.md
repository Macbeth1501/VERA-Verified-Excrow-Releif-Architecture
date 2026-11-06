# VERA MVP — Additional Features (Built Beyond the Planning Docs)

This file lists what the code does that the planning documents do not describe: `Project_Overview.md`, `VERA_MVP_SPDD.md`, `VERA_MVP_Functional_Roadmap.md` and `Technical_Details.md`. It is not a changelog. `PROGRESS_LOG.md` holds the history and was not used as a comparison source here.

Each entry says what the feature is, where it lives, and which document it is missing from. "Not in" means a search of that document found no description of the feature.

Per the SPDD rule, the SPDD is not edited to match the code. This file is the place where those extras are recorded.

---

## 1. Public pages and navigation

| # | Feature | Where | What it does | Not in |
| :-- | :-- | :-- | :-- | :-- |
| 1.1 | **Chain activity timeline** | `app/activity/page.tsx`, `lib/activity/`, `GET /api/v1/activity` | Public feed of every indexed on-chain event across all campaigns and contracts, newest first. Each row has a plain-English sentence, the emitting contract, a link to its campaign, and a Polygonscan link. Filters by campaign and event type, paging, and a "data as of block N" banner. It never shows beneficiary fingerprints or payout references. Linked from the top bar, the home page, and each campaign page as `/activity?campaign=<id>`. | All four docs |
| 1.2 | **"How it works" page** | `app/how-it-works/page.tsx` | Plain-words explanation for visitors: who does what, a glossary, and the contract names. Linked from the top bar and footer. | All four docs |
| 1.3 | **Network totals on the home page** | `lib/campaigns/network.ts`, `app/page.tsx` | Platform-wide donated, held, released and paid-out figures plus confirmed milestones. They are summed from indexed events over published (LIVE) campaigns only, so test vaults do not inflate them. When there is nothing to show it returns null and the page describes the mechanism instead of inventing a number. | All four docs |
| 1.4 | **Public organizer profile** | `app/organizers/[id]/page.tsx` | "Verified organizer" badge, their live campaigns, and their donated, released and paid-out totals. | Overview, Roadmap, Technical Details |
| 1.5 | **Campaigns list page** | `app/campaigns/page.tsx` | Public browse page of live campaigns. | Only implied |
| 1.6 | **Donation receipt / resume page** | `app/donations/[id]/page.tsx`, `DonationProgress.tsx` | Shows a donation's progress and lets a donor resume or retry it. | All four docs |

## 2. Role-aware workspace

| # | Feature | Where | What it does | Not in |
| :-- | :-- | :-- | :-- | :-- |
| 2.1 | **Role-aware dashboard landing** | `lib/nav/roles.ts` (`roleHome`), `app/dashboard/*` | `/dashboard` redirects each role to its own workspace: donor `/dashboard/donor`, organizer `/dashboard/campaigns`, plus attestor, council and admin consoles. The donor page shows balance and "Your donations", each linked to its campaign. | All four docs |
| 2.2 | **Role-aware top bar with session-clash warning** | `components/SiteNav.tsx`, `GET /api/v1/auth/session` | Per-role links and "signed in as". It polls the session and shows an amber warning when another window of the same browser profile signed in as someone else, because all windows share one `vera_session` cookie. | All four docs |
| 2.3 | **Admin role manager** | `components/RoleManager.tsx`, `POST /api/v1/admin/roles` | Admin grants and revokes the attestor and council roles from the console. Granting writes the DB first and then the contract. Revoking goes contract first. Organizers and admins cannot hold either role. Every change is stored in `role_grants`. | SPDD (partial), Roadmap, Overview |
| 2.4 | **Retry organizer on-chain sync** | `POST /api/v1/admin/organizers/:id/sync` | If mirroring an approved organizer to `CampaignFactory.setOrganizerVerified` fails, an admin can retry it. The result is kept in `organizer_profiles.chain_sync`. | All four docs |
| 2.5 | **Admin promotion script** | `apps/web/scripts/promote-admin.mjs` (`pnpm admin:promote`) | The only way to create an admin. No web route grants admin. | All four docs |
| 2.6 | **Page reachability test** | `lib/nav/reachability.test.ts` | Walks every `page.tsx` and fails if a page has no link pointing at it, or if a link points at a page that does not exist. | All four docs |
| 2.7 | **Authorization read from the DB on every request** | `lib/api/guards.ts` (`requireUser`) | The role is never trusted from the session token. An approved organizer or new admin works immediately with an old cookie. | Technical Details, Roadmap, Overview |
| 2.8 | **Attestor-count guard** | `countSyncedRole`, `attestationShortfalls` in `lib/escrow/service.ts`, `POST /api/v1/campaigns`, `CampaignForm.tsx`, `/dashboard/admin` | A campaign cannot ask for more confirmations than there are registered, synced attestors (422, only when escrow is configured). The form shows the attestor count, and the admin console warns when removing an attestor would strand an open milestone. App-level only: the contract cannot count attestors. | All four docs |
| 2.9 | **Admin council-approval limit** | `components/ReleaseLimitManager.tsx`, `GET/POST /api/v1/admin/release-limit`, `lib/escrow/limits.ts`, `lib/escrow/release-limit.ts` | The admin reads and changes the manager's global limit above which the council must approve. A confirmation step precedes the sponsored transaction; a limit at or above the biggest campaign goal triggers a warning; 0 means every release needs the council. A change applies only to campaigns published afterwards (each milestone snapshots the limit). Unreadable chain shows "unavailable", never a guessed value. | All four docs |
| 2.10 | **Admin council threshold (K)** | `components/CouncilThresholdManager.tsx`, `GET/POST /api/v1/admin/council-threshold`, `lib/escrow/threshold.ts`, `lib/escrow/threshold-effect.ts`, `/dashboard/council` | The admin reads and changes how many council approvals a large release needs. Refused below 2 and above the registered council size. The confirmation step lists every release now waiting for the council and what the change does to it. Not snapshotted: it takes effect at once. The council console shows the current number. | All four docs |
| 2.11 | **Admin registered-users directory** | `/dashboard/admin/users`, `GET /api/v1/admin/users`, `lib/admin/users.ts` | The admin sees every account with its email address, role, wallet address (shortened, "own wallet" flagged), organizer-application status and registration time (IST), with a case-insensitive email search, a role filter with counts, and paging (50 a page). Admin only (emails are personal data), role read from the database on every request. Columns are named explicitly, so the password hash, email hash and encrypted wallet key are never selected or returned. Search uses `instr`, so `%` and `_` are plain characters. Linked from the admin console. | All four docs |

## 3. Campaign expiry and donor refunds (web layer)

The contract side (`close()`, `claimRefund()`, deadline, inactivity window) is in `Technical_Details.md`. The web layer around it is not described in the Roadmap, Overview or SPDD.

| # | Feature | Where | What it does |
| :-- | :-- | :-- | :-- |
| 3.1 | **Duration and inactivity settings** | `CampaignForm.tsx`, migration `0009` | Organizer sets `duration_days` (default 90) and `inactivity_days` (default 30). Publishing computes the deadline from the chain's own clock and sends both to the Factory. |
| 3.2 | **Expiry panel** | `components/ExpiryPanel.tsx`, `lib/expiry/` | Shows state (open, ended, closed), the deadline, the inactivity deadline, and the reason a campaign can be closed. |
| 3.3 | **Close and refund routes** | `POST /api/v1/campaigns/:id/close`, `GET\|POST /api/v1/campaigns/:id/refund` | Any signed-in user can close a closable campaign, with gas sponsored. A donor claims their own refund, signed by their own generated wallet with sponsored gas. Nothing is stored for either action: the chain events are the record. |
| 3.4 | **Older campaigns handled gracefully** | `lib/expiry/service.ts` | A vault published before expiry existed has no `deadline_at`. Its page says it has no end date and the routes answer `EXPIRY_NOT_AVAILABLE`. |
| 3.5 | **Donations refused after the deadline** | `lib/donations/service.ts` | `createDonation` rejects a donation once the deadline has passed. |
| 3.6 | **Refund-aware reconciliation** | `lib/indexer/queries.ts` | Balance is donated minus released minus refunded, so the three-way check still matches after refunds. |

## 4. Donations: resumable engine and extras

| # | Feature | Where | What it does | Not in |
| :-- | :-- | :-- | :-- | :-- |
| 4.1 | **Resumable donation state machine** | `lib/donations/advance.ts`, `POST /api/v1/donations/:id/advance` | A donation is not one long request. The browser calls `advance` about every 1.5 s and each call sends one step (`gas`, `mint`, `fee` if any, `approve`, `deposit`). The tx hash is saved before waiting, and an atomic lock (`locked_until`) stops a step running twice. | Overview, SPDD, Technical Details |
| 4.2 | **Retry a failed donation** | `POST /api/v1/donations/:id/retry` | Resumes a FAILED donation from the step that failed. | All four docs |
| 4.3 | **Safe failure rule** | `lib/donations/advance.ts` | An error while checking an already-sent transaction leaves the donation PENDING, never FAILED. A donation is CONFIRMED only after its `DonationReceived` event (vault, donor, amount) is read from the receipt. | All four docs |
| 4.4 | **Optional flat platform fee** | `lib/env.ts` (`PLATFORM_FEE_MINOR_UNITS`, `PLATFORM_FEE_ADDRESS`) | Default 0. When set, it is shown to the donor as an itemized, never pre-selected choice, paid on top of the donation. The address is required whenever a fee is set. | Overview, Technical Details, SPDD |
| 4.5 | **Own-wallet address stored unverified** | `lib/auth/users.ts` | A user can record their own wallet address, but without SIWE it is not verified and cannot be signed for, so those users cannot publish campaigns or donate. | Overview |

## 5. Escrow, beneficiaries and payouts

| # | Feature | Where | What it does | Not in |
| :-- | :-- | :-- | :-- | :-- |
| 5.1 | **Pre-flight checks before any gas is spent** | `lib/disbursement/service.ts`, `POST /api/v1/milestones/:id/disburse` | Reads the milestone state, whether it was already paid, `payableRemaining`, and the organizer's balance and allowance in one call. A bad request is refused before any transaction. The `approve` step is skipped if an existing allowance covers the amount. | Overview, Roadmap, SPDD |
| 5.2 | **Contract errors turned into plain sentences** | `lib/chain/manager.ts` | Each call is simulated first, so a custom revert becomes a readable message. Each call is funded from its own gas estimate. | All four docs |
| 5.3 | **Milestone action log with retry** | `milestone_actions` table, `lib/escrow/service.ts` | One row per milestone, kind and actor. The hash is saved before waiting, an unknown outcome stays PENDING, and a FAILED row is reused on retry. | All four docs |
| 5.4 | **Idempotent milestone definition** | `POST /api/v1/campaigns/:id/milestones/define` | Signs as the organizer and adopts definitions already on-chain, so it is safe to repeat. | All four docs |
| 5.5 | **Per-campaign beneficiary salt, kept separate** | `campaign_salts` table, `GET /api/v1/campaigns/:id/beneficiaries/salt` | Salt lives in its own table because campaign rows are returned wholesale by routes. Fingerprints use NFKC normalisation and `SHA256(salt + "\0" + fragment)`. A repeat is refused three ways: DB unique index, a chain pre-check, then the contract. | Overview, Roadmap, SPDD (only partly) |
| 5.6 | **Admin can act as the organizer** | `lib/chain/campaigns.ts`, deploy, disburse and define routes | An admin retrying a publish, definition or payout still signs as the organizer, so the Factory records the right `msg.sender`. | All four docs |
| 5.7 | **Organizer wallet top-up before publish** | `lib/chain/sponsor.ts` | The sponsor sends POL to the organizer's wallet before it publishes. Sponsor sends are serialised so concurrent top-ups cannot race for a nonce. | Overview, Roadmap, SPDD |
| 5.8 | **Campaign saved as DRAFT, published separately** | `POST /api/v1/campaigns/:id/deploy`, `PublishCampaignButton.tsx` | A campaign is stored first with no vault. Deploy is idempotent and retryable. | Overview, Roadmap |
| 5.9 | **Attestor-verified beneficiaries (app-enforced)** | `lib/beneficiary/attestation.ts`, `lib/beneficiary/verification.ts`, `POST /api/v1/campaigns/:id/beneficiaries/attestations`, `BeneficiaryVerifyForm.tsx` on `/dashboard/attestor`, migration `0010`, `lib/disbursement/service.ts` | An attestor who met a beneficiary fingerprints them in their own browser and confirms them (optionally with an evidence file, purpose `beneficiary_evidence`, opened by admins and attestors only). Each attestor counts once; the organizer and non-attestors are refused; a wrong fingerprint answers only "no match" (rate-limited per attestor). Verified = enough distinct attestors (`BENEFICIARY_REQUIRED_ATTESTATIONS`, default 1), derived by counting, never stored. A payout to an unverified beneficiary is refused with 409 `BENEFICIARY_NOT_VERIFIED`. The organizer's beneficiary rows, the payout picker and the public campaign page ("N of M verified") show the state. Attestors can now read a campaign's salt. **Not on-chain** unless the V2 contracts are deployed and `BENEFICIARY_REGISTRY_V2=1` (C6): then the attestor's wallet also confirms on `BeneficiaryRegistryV2`, the row tracks its chain status (`0011`), only confirmed rows count, and the indexer reads `BeneficiaryAttested`. Not deployed on Amoy. | None |

## 6. Indexer and dashboard behaviour

| # | Feature | Where | What it does | Not in |
| :-- | :-- | :-- | :-- | :-- |
| 6.1 | **Stale-while-read sync** | `lib/indexer/runtime.ts` (`syncIfStale`) | No background worker. A 10 s window with one shared in-flight pass refreshes the index on read. | Overview, Roadmap, SPDD |
| 6.2 | **Self-adjusting reads** | `lib/indexer/sync.ts` | Chunks reads and halves a chunk when an RPC refuses the range. The cursor advances only after events are stored. It reads only blocks 2 confirmations deep. | Overview, Roadmap, SPDD |
| 6.3 | **Separate event streams** | indexer env vars `MANAGER_START_BLOCK`, `REGISTRY_START_BLOCK`, `DISBURSEMENT_START_BLOCK` | Independent cursors for the manager, registry and disbursement contracts. The indexer is off unless `FACTORY_ADDRESS` and `INDEXER_START_BLOCK` are set. | Overview, Roadmap, SPDD |
| 6.4 | **Lag warning** | `lib/indexer/freshness.ts` | After 60 blocks behind the head (about 2 minutes on Amoy) the banner turns amber. Freshness has four states: current, lagging, unknown, off. | Overview, Roadmap, Technical Details |
| 6.5 | **Reconciliation failure reasons** | `classifyReconcileError` in `lib/campaigns/dashboard.ts` | Distinguishes a node that pruned old state (`state_pruned`), an unreachable node (`unreachable`), and other errors. | Overview, Roadmap, SPDD |
| 6.6 | **Chain-unreadable shows "unavailable", never zero** | `lib/campaigns/dashboard.ts` | A failed read is never displayed as a zero balance. | Overview, Roadmap, Technical Details |
| 6.7 | **Single source for the public view** | `buildDashboard` | The campaign page, the ledger API and the CSV/JSON export all use it, so they cannot disagree. | Overview, Technical Details |
| 6.8 | **Live-refresh dashboard** | `components/LedgerDashboard.tsx` | Polls every 10 s while the tab is visible. | Overview, Roadmap, SPDD, Technical Details |
| 6.9 | **Hand-written IST formatter** | `formatIst` in `lib/campaigns/format.ts` | Every displayed time is Indian Standard Time (UTC+05:30, fixed, no daylight saving), e.g. `19 Sep 2026, 10:01 IST`. Not `Intl`, so server and browser text cannot differ. API responses, CSV/JSON exports and the database stay ISO 8601 UTC. | All four docs |
| 6.10 | **Manual indexer routes** | `POST /api/v1/indexer/sync` (admin only), `/reconcile`, `GET /status` | Routes for forcing a sync, running a reconciliation, and reading indexer status. | Overview, Roadmap |

## 7. Documents

| # | Feature | Where | What it does | Not in |
| :-- | :-- | :-- | :-- | :-- |
| 7.1 | **Uploaded files, not just hashes** | `lib/files/service.ts`, `documents` table | KYB documents and attestor evidence are stored as well as hashed, so a reviewer can open them. This reverses the original "hash only" design, done at the project owner's request. | Overview, Roadmap, SPDD |
| 7.2 | **Server re-hash on upload** | `saveDocument` | The server hashes the uploaded bytes again and refuses a mismatch with the hash the browser computed. | Overview, Roadmap, SPDD |
| 7.3 | **Upload limits and allowlist** | `lib/files/service.ts` | 8 MB cap. Only JPEG, PNG, WEBP, GIF and PDF are accepted, never a script-executable type. | Overview, Roadmap, SPDD |
| 7.4 | **Purpose-based access** | `GET /api/v1/documents/:id` | `kyb` files are admin-only. `milestone_evidence` is admin, attestor and council. | Overview, Roadmap, SPDD |
| 7.5 | **Optional document links** | `documentId` / `evidenceDocumentId` | Optional foreign keys, so a client that sends only a hash still works with nothing to view. | All four docs |

## 8. Visual design system

| # | Feature | Where | What it does |
| :-- | :-- | :-- | :-- |
| 8.1 | **Designed dark theme** | `app/globals.css`, `apps/web/DESIGN.md`, `apps/web/PRODUCT.md` | Warm charcoal ground, cream ink, one copper accent. Tokens for status colours. No light mode and no OS switch. WCAG AA contrast checked with numbers. |
| 8.2 | **Typography** | `app/layout.tsx` | Besley for headings and money, Hanken Grotesk for text, Geist Mono for hashes. |
| 8.3 | **Four-stage money rail** | `components/StageRail.tsx` | Money is shown as a ruled statement of account plus a four-stage rail, not cards or hero metrics. |
| 8.4 | **Shared page head** | `components/PageHead.tsx` | Back link, display title, lead and optional action on workspace pages. |
| 8.5 | **Accessibility basics** | `app/layout.tsx`, `globals.css` | Skip-to-content link, global hover and focus styles, one 1152px container shared by all pages. |
| 8.6 | **Design-tool records** | `apps/web/.impeccable/` | Critique files, design JSON and the previous baseline, kept for the design panel. |

## 9. API and platform hardening

| # | Feature | Where | What it does | Not in |
| :-- | :-- | :-- | :-- | :-- |
| 9.1 | **Token-bucket rate limiter** | `lib/api/rate-limit.ts` | In-memory, per client key, applied to mutating routes. Fine for one process, not for several instances. | Overview, Roadmap |
| 9.2 | **Error envelope with specific codes** | `lib/api/errors.ts` | Every error uses the SPDD §12.3 envelope with a specific code, never a bare 500. | Overview, Roadmap, Technical Details |
| 9.3 | **Chain calls never throw** | `lib/chain/*` | Every chain operation returns a result to record and retry. The decision is saved to the DB first, so a chain failure never loses it. | All four docs |
| 9.4 | **Money rules** | `lib/campaigns/money.ts` | Amounts are integer mINR minor units in strings, never floats, and never stored where they can be derived. | Overview, Roadmap |
| 9.5 | **Cheap bcrypt under test** | `lib/auth/password.ts` | A low cost factor only when `NODE_ENV=test`. | All four docs |

## 10. Testing and tooling

| # | Feature | Where | What it does | Not in |
| :-- | :-- | :-- | :-- | :-- |
| 10.1 | **Fake-chain ports** | `chain-port.ts` and `fake-chain.ts` in each of `beneficiary`, `disbursement`, `donations`, `escrow`, `expiry`, `indexer` | Each area depends on a port, with a fake chain that mirrors the contract's rules, so logic is tested without a network. | Overview, Roadmap, SPDD |
| 10.2 | **Route-handler integration tests** | `*.integration.test.ts` | Call the exported route handlers directly against an in-memory DB, mocking only the chain module. | Overview, Roadmap |
| 10.3 | **Free local end-to-end proofs** | `lib/disbursement/live-local.test.ts`, `lib/expiry/live-local.test.ts` (`LIVE_LOCAL=1`) | Run against a local anvil chain only and refuse any other RPC. The expiry test moves anvil's clock with `evm_increaseTime`. | All four docs |
| 10.4 | **Opt-in real-chain test** | `lib/escrow/live-amoy.test.ts` (`LIVE_AMOY=1`) | Covers publish, attest, council, release, beneficiary, payout and reconciliation on Amoy. It refuses to start under 1 POL, retries a transient `CHAIN_FAILED` twice, and prints every failed response. | Overview, Roadmap, SPDD, Technical Details |
| 10.5 | **Environment validation** | `lib/env.ts`, `lib/env.test.ts` | Validated settings, including the rule that the fee address is required when a fee is set. | Overview, Roadmap |
| 10.6 | **Forward-only migrations** | `apps/web/drizzle/0000`–`0011` | Twelve migrations, one per feature area. | Overview, Roadmap |

## 11. Operations, documents and repository extras

| # | Feature | Where | What it does |
| :-- | :-- | :-- | :-- |
| 11.1 | **Mock off-ramp reference** | `lib/chain/mockOffRamp.ts` | Generates a payout reference string. Only its hash goes on-chain. |
| 11.2 | **Disbursement placed downstream of the manager** | `contracts/src/Disbursement.sol` | A deliberate divergence from SPDD §18.4. The manager already pays the organizer and cannot change, so the organizer hands the money on to this contract. It enforces a per-campaign cap using `manager.releasedTotal(vault)`. |
| 11.3 | **Mining and manual-test guides** | `docs/mining_instructions.md`, `manual_test_live.md`, `manual_test_local.md` | How to top up the gas-sponsor wallet, a live Amoy walkthrough with per-step cost, and a zero-POL local anvil walkthrough. |
| 11.4 | **Screenshot set** | `media/` | Numbered screenshots of the live walkthrough, public landing through chain activity. |
| 11.5 | **Knowledge graph** | `graphify-out/`, `.graphifyignore` | A generated map of code and docs for architecture questions. It excludes vendored libraries and wallet material. |
| 11.6 | **Static analysis record** | Slither run over all eight contracts in `src/` | 9 informational/low results and none medium or high (the ninth is a `missing-inheritance` note on `BeneficiaryRegistryV2`). |
| 11.7 | **Contract fuzz tests** | `contracts/test/` | Deposit fuzz tests at 10,000 runs. |

---

## Notes on accuracy

- Searches were keyword based. A feature marked "Not in" a document may still be hinted at in different words.
- Section 3 and the pause and refund rows in `Technical_Details.md` were added in recent uncommitted edits, so they are covered there for the contract only.
- File and route names were taken from `docs/CLAUDE.md` and spot-checked in the code. Counts such as test totals were left out because they change.
