# Graph Report - vera-mvp  (2026-09-21)

## Corpus Check
- 195 files · ~108,417 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .sol 13, (none) 4, .example 1)

## Summary
- 1178 nodes · 3346 edges · 69 communities (60 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `75382052`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- getDb
- escrow/service.ts
- CampaignForm.tsx
- getEnv
- donations/service.ts
- MilestoneManager contract
- users.ts
- beneficiary/service.ts
- CampaignVault.sol (escrow)
- campaign.ts
- store.ts
- indexer.integration.test.ts
- dashboard/campaigns/[id]/page.tsx
- Tx
- dashboard.ts
- queries.ts
- Mining POL on Polygon Amoy — Step-by-Step Guide
- session.ts
- compilerOptions
- package.json
- web/package.json
- AdminReviewList.tsx
- AuthForm.tsx
- LedgerDashboard.tsx
- devDependencies
- compilerOptions
- BeneficiaryForm.tsx
- dependencies
- types/package.json
- requirePageUser
- next
- FakeChain
- disbursement.test.ts
- scripts
- History
- Module 2.1 Campaign Creation
- account/page.tsx
- contracts/package.json
- layout.tsx
- Module 3.2 Milestone State Machine & Multi-Confirmation
- eslint.config.mjs
- zod
- Layered Architecture L0-L3
- VERA MVP Functional Roadmap
- apps/web pnpm-workspace.yaml (sharp/unrs-resolver builds disabled)
- postcss.config.mjs
- Module 4.1 Beneficiary Uniqueness Registry
- Module 4.3 Security Review & Reconciliation Hardening
- Git rule: never commit or push
- MockINR (mINR) token
- contracts remappings.txt
- Manual test guide: run and test VERA in your browser, for free
- campaigns/service.ts
- signSession
- councilWorkflow.ts
- formatMinorUnits
- auth.integration.test.ts
- EscrowChain
- disbursement/service.ts
- Escrow services (lib/escrow: service, attestationCollector, councilWorkflow)
- donations/[id]/page.tsx
- DonatePanel.tsx
- promote-admin.mjs
- runtime.ts
- Open items
- 2. Daily loop (repeat each day)
- VERA MVP — Progress Log
- RoleManager.tsx
- Gas-price guard (150 gwei refusal, gasPriceRefusal)

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 105 edges
2. `apiError()` - 62 edges
3. `requireUser()` - 48 edges
4. `getEnv()` - 43 edges
5. `next` - 32 edges
6. `getCampaign()` - 30 edges
7. `vitest` - 27 edges
8. `drizzle-orm` - 26 edges
9. `findUserById()` - 25 edges
10. `Db` - 24 edges

## Surprising Connections (you probably didn't know these)
- `2026-09-19 — Review, remediation, and Step 3 completion` --references--> `createCampaign()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/campaigns/service.ts
- `2026-09-19 - RPC fallback for the web app` --references--> `parseRpcUrls()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/env.ts
- `Cost and operations` --references--> `syncIfStale()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/indexer/runtime.ts
- `2026-09-19 - Step 7: Campaign Creation (FR-CMP-01)` --references--> `createCampaign()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/campaigns/service.ts
- `2026-09-19 - Step 8: Indexing core events` --references--> `FakeChain`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/indexer/fake-chain.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Milestone attestation, council approval and release flow** — docs_progress_log_step_11_attestation, docs_progress_log_step_12_council, claude_milestonemanager, claude_auto_release_limit, claude_escrow_services [EXTRACTED 0.95]
- **Milestone release pipeline (attestation, state machine, council approval)** — docs_vera_mvp_functional_roadmap_module_3_3, docs_vera_mvp_functional_roadmap_module_3_2, docs_vera_mvp_functional_roadmap_module_3_4 [EXTRACTED 0.95]
- **Donate-to-Disburse Escrow Flow** — docs_vera_mvp_spdd_campaignvault, docs_vera_mvp_spdd_milestonemanager, docs_vera_mvp_spdd_trusted_attestor, docs_vera_mvp_spdd_council_multisig, docs_vera_mvp_spdd_disbursement [EXTRACTED 1.00]
- **VERA On-Chain Contract Suite** — docs_vera_mvp_spdd_campaignfactory, docs_vera_mvp_spdd_campaignvault, docs_vera_mvp_spdd_milestonemanager, docs_vera_mvp_spdd_beneficiaryregistry, docs_vera_mvp_spdd_disbursement, docs_vera_mvp_spdd_mockusdc [EXTRACTED 1.00]
- **Chain-to-dashboard transparency flow (indexing, dashboard, reconciliation)** — docs_vera_mvp_functional_roadmap_module_2_2, docs_vera_mvp_functional_roadmap_module_2_3, docs_vera_mvp_functional_roadmap_module_4_3 [INFERRED 0.85]
- **Sponsor wallet gas protection rules** — claude_sponsor_wallet, claude_gas_price_guard, docs_progress_log_testnet_pol_rule, docs_mining_instructions_gas_price_check, docs_progress_log_sponsor_drain_incident [INFERRED 0.85]
- **Free Replacements for Deferred Primitives** — docs_vera_mvp_spdd_trusted_attestor, docs_vera_mvp_spdd_hash_commitment_dedup, docs_vera_mvp_spdd_simulated_ramps, docs_vera_mvp_spdd_deferred_features [INFERRED 0.85]

## Communities (69 total, 9 thin omitted)

### Community 0 - "getDb"
Cohesion: 0.05
Nodes (99): POST(), POST(), GET(), STATUSES, GET(), POST(), campaignInput, chain (+91 more)

### Community 1 - "escrow/service.ts"
Cohesion: 0.15
Nodes (24): PublicUser, CampaignWithMilestones, CampaignRow, MilestoneActionRow, milestoneActions, MilestoneRow, milestones, NewUserRow (+16 more)

### Community 2 - "CampaignForm.tsx"
Cohesion: 0.17
Nodes (17): blankMilestone, FieldErrors, MilestoneDraft, CAMPAIGN_CATEGORIES, CampaignCategory, CATEGORY_ADMIN_CEILING_PCT, CATEGORY_ENUM_INDEX, CATEGORY_LABEL (+9 more)

### Community 3 - "getEnv"
Cohesion: 0.07
Nodes (59): decryptSecret(), getMinrBalance(), MINR_DECIMALS, deployCampaignVault(), factoryAbi, failed(), transport(), createDisbursementChain() (+51 more)

### Community 4 - "donations/service.ts"
Cohesion: 0.07
Nodes (34): DonationRow, donations, acquire(), advanceDonation(), AdvanceOptions, fail(), hashOf(), hashPatch() (+26 more)

### Community 5 - "MilestoneManager contract"
Cohesion: 0.16
Nodes (15): VERA web app README, Auto-release limit (100 mINR) and council threshold (3), Deployed addresses on Polygon Amoy, Indexer manager stream (MANAGER_START_BLOCK), MilestoneManager contract, VERA_MVP_SPDD design source of truth, VERA contracts README, Faucet mining guide (+7 more)

### Community 6 - "users.ts"
Cohesion: 0.17
Nodes (16): encryptSecret(), hashEmail(), normalizeEmail(), KEY, DUMMY_HASH, hashPassword(), MIN_PASSWORD_LENGTH, verifyPassword() (+8 more)

### Community 7 - "beneficiary/service.ts"
Cohesion: 0.10
Nodes (32): body(), H(), shared, GET(), POST(), GET(), BeneficiariesPage(), dynamic (+24 more)

### Community 8 - "CampaignVault.sol (escrow)"
Cohesion: 0.07
Nodes (37): On-Chain Admin-Expense Ceiling, Admin Role Has No Fund-Transfer Capability, REST API v1 Design, Auto-Release vs Council-Approval Branching, BeneficiaryRegistry.sol, CampaignFactory.sol, CampaignVault.sol (escrow), Ground-Truth Fraud Case Evidence (Ayodhya, Feeding Our Future, FireAid, SantaCon, GoFundMe, Mumbai, Women's Cancer Fund) (+29 more)

### Community 9 - "campaign.ts"
Cohesion: 0.08
Nodes (22): Beneficiary, Campaign, CampaignCategory, COMMUNITY, DISASTER_RELIEF, MEDICAL, CampaignStatus, COMPLETED (+14 more)

### Community 10 - "store.ts"
Cohesion: 0.16
Nodes (13): ChainEventRow, chainEvents, indexerCursors, getCursor(), insertEvents(), setCursor(), Fetch, message() (+5 more)

### Community 11 - "indexer.integration.test.ts"
Cohesion: 0.14
Nodes (17): ENC_KEY, liveCampaign(), makeUser(), shared, attested(), beneficiary(), created(), donation() (+9 more)

### Community 12 - "dashboard/campaigns/[id]/page.tsx"
Cohesion: 0.20
Nodes (11): CampaignDetailPage(), CHAIN_COPY, dynamic, ActionButton(), AttestForm(), hashFile(), CardMode, KIND_LABEL (+3 more)

### Community 13 - "Tx"
Cohesion: 0.08
Nodes (19): BeneficiaryChain, FakeBeneficiaryChain, DisbursementChain, PayoutState, disburse(), FakeDisbursementChain, disburseMilestone(), fail() (+11 more)

### Community 14 - "dashboard.ts"
Cohesion: 0.18
Nodes (20): GET(), GET(), CampaignPage(), dynamic, generateMetadata(), buildDashboard(), DashboardData, goalReachedBps() (+12 more)

### Community 15 - "queries.ts"
Cohesion: 0.19
Nodes (15): GET(), GET(), ACTOR_KEY, indexerStatus, MILESTONE_EVENTS, reconcileVault(), ReconciliationRow, vaultLedger() (+7 more)

### Community 16 - "Mining POL on Polygon Amoy — Step-by-Step Guide"
Cohesion: 0.17
Nodes (12): 0. Main wallet details (the destination), 1.1 Network settings (RPC URL, chain ID, etc.), 1.2 Set the RPC for your terminal session, 1.3 The project's own RPC setting (for contract work), 1.4 (Optional) Add Amoy to MetaMask, 1.5 Make a safe folder for temp-wallet keys, 1. One-time setup, 3. Optional: log your running total (+4 more)

### Community 17 - "session.ts"
Cohesion: 0.19
Nodes (16): GET(), AdminPage(), metadata, metadata, OrganizerPage(), STATUS_COPY, getRequestUser(), key() (+8 more)

### Community 18 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 19 - "package.json"
Cohesion: 0.12
Nodes (16): description, devEngines, packageManager, name, name, onFail, version, private (+8 more)

### Community 20 - "web/package.json"
Cohesion: 0.12
Nodes (14): typescript, name, private, version, drizzle-kit, jose, react-dom, tailwindcss (+6 more)

### Community 21 - "AdminReviewList.tsx"
Cohesion: 0.40
Nodes (3): AdminReviewList(), CHAIN_LABEL, ReviewItem

### Community 22 - "AuthForm.tsx"
Cohesion: 0.18
Nodes (6): metadata, metadata, AuthForm(), COPY, FieldErrors, Mode

### Community 23 - "LedgerDashboard.tsx"
Cohesion: 0.32
Nodes (9): LedgerDashboard(), milestoneProgress(), ReconciliationBadge(), useLiveData(), formatBps(), formatUtc(), MONTHS, shortAddress() (+1 more)

### Community 24 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, drizzle-kit, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/better-sqlite3, @types/node (+4 more)

### Community 25 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck (+3 more)

### Community 26 - "BeneficiaryForm.tsx"
Cohesion: 0.21
Nodes (13): BeneficiaryForm(), submit(), Notice, short(), TONE, FieldErrors, OrganizerApplyForm(), onFile() (+5 more)

### Community 27 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, bcryptjs, better-sqlite3, drizzle-orm, jose, next, react, react-dom (+3 more)

### Community 28 - "types/package.json"
Cohesion: 0.18
Nodes (10): devDependencies, typescript, typescript, main, name, private, scripts, typecheck (+2 more)

### Community 29 - "requirePageUser"
Cohesion: 0.29
Nodes (9): AttestorPage(), dynamic, metadata, CouncilPage(), dynamic, metadata, MilestoneCard(), requirePageUser() (+1 more)

### Community 30 - "next"
Cohesion: 0.23
Nodes (7): metadata, NewCampaignPage(), CampaignsPage(), metadata, requirePageOrganizer(), nextConfig, next

### Community 32 - "disbursement.test.ts"
Cohesion: 0.10
Nodes (24): cookieFor(), setup(), cookieFor(), ctx(), drive(), req(), start(), cookieFor() (+16 more)

### Community 33 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, admin:promote, build, db:generate, dev, lint, start, test (+1 more)

### Community 34 - "History"
Cohesion: 0.20
Nodes (10): retry(), 2026-09-19 — Faucet mining guide, 2026-09-19 — Review, remediation, and Step 3 completion, 2026-09-19 - RPC fallback for the web app, 2026-09-19 - Step 10: Donation flow / simulated on-ramp (FR-CMP-02), 2026-09-19 - Step 5: Donor Registration (FR-IDN-01), 2026-09-19 - Step 6: Mock Organizer KYB (FR-IDN-02), 2026-09-19 - Step 7: Campaign Creation (FR-CMP-01) (+2 more)

### Community 35 - "Module 2.1 Campaign Creation"
Cohesion: 0.25
Nodes (8): Fund figures written only by indexer, never by app, Three-layer defense-in-depth validation (UI, backend, contract), Module 1.3 Donor Identity & Onboarding, Module 1.4 Organizer Verification (Mock KYB), Module 2.1 Campaign Creation, Module 2.2 On-Chain Event Reading / Indexing, Module 2.3 Public Audit Dashboard, Module 3.1 Donation Flow (Simulated Funding)

### Community 36 - "account/page.tsx"
Cohesion: 0.39
Nodes (6): AccountPage(), loadBalance(), metadata, LogoutButton(), formatRupees(), listDonations()

### Community 37 - "contracts/package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, build, test, version

### Community 38 - "layout.tsx"
Cohesion: 0.33
Nodes (4): apps_web_app_globals, geistMono, geistSans, metadata

### Community 39 - "Module 3.2 Milestone State Machine & Multi-Confirmation"
Cohesion: 0.40
Nodes (5): Hard-coded admin-expense cap ceiling, M-of-N unique confirmations per milestone, Module 3.2 Milestone State Machine & Multi-Confirmation, Module 3.3 Attestation (Verification) Flow, Module 3.4 Multi-Party Council Approval

### Community 40 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 41 - "zod"
Cohesion: 0.50
Nodes (3): DisburseInput, disburseSchema, zod

### Community 42 - "Layered Architecture L0-L3"
Cohesion: 0.50
Nodes (4): Defense-in-Depth Layers (client, API, DB, contract), Error-Flow Philosophy (funds stay locked on failure), Layered Architecture L0-L3, Public Testnet Ledger (Polygon Amoy / Sepolia)

### Community 43 - "VERA MVP Functional Roadmap"
Cohesion: 0.67
Nodes (3): VERA MVP Functional Roadmap, Module 1.1 Project Foundation & Shared Vocabulary, Module 1.2 Core On-Chain Escrow Skeleton

### Community 51 - "Manual test guide: run and test VERA in your browser, for free"
Cohesion: 0.08
Nodes (25): 0. What you will have open, 10. Starting over, 11. Going back to normal (the real Amoy testnet), 12. Troubleshooting, 13. What this test does not prove, 1. Prerequisites (one-time), 2. Get the project ready (one-time), 3. Start the local blockchain (+17 more)

### Community 52 - "campaigns/service.ts"
Cohesion: 0.20
Nodes (16): POST(), GET(), getWalletKeyEnc(), CampaignNotFoundError, ChainStatus, getCampaign(), listByOrganizer(), listLive() (+8 more)

### Community 53 - "signSession"
Cohesion: 0.23
Nodes (12): POST(), POST(), clientKey(), sessionCookieHeader(), signSession(), email, LoginInput, loginSchema (+4 more)

### Community 54 - "councilWorkflow.ts"
Cohesion: 0.40
Nodes (14): Prepared, prepareMilestone(), submitAttestation(), councilApprove(), releaseMilestone(), fail(), loadMilestone(), MilestoneView (+6 more)

### Community 55 - "formatMinorUnits"
Cohesion: 0.23
Nodes (9): CampaignsIndexPage(), dynamic, metadata, CampaignForm(), onSubmit(), payload(), DonatePanel(), formatMinorUnits() (+1 more)

### Community 56 - "auth.integration.test.ts"
Cohesion: 0.21
Nodes (9): balanceMock, ENC_KEY, post(), signUp(), userRow(), POST(), clearSessionCookieHeader(), cookieAttributes() (+1 more)

### Community 58 - "disbursement/service.ts"
Cohesion: 0.25
Nodes (9): createPayoutReference(), hashPayoutReference(), PayoutReference, Db, DisbursementRow, DisbursementFailure, DisbursementView, Outcome (+1 more)

### Community 59 - "Escrow services (lib/escrow: service, attestationCollector, councilWorkflow)"
Cohesion: 0.18
Nodes (11): Chain operations never throw; DB record saved first, Donation resumable state machine, Escrow services (lib/escrow: service, attestationCollector, councilWorkflow), EscrowChain port (chain-port.ts) with real manager.ts and fake-chain, live-amoy.test.ts opt-in real-chain test, Sponsor wallet (lib/chain/sponsor.ts), Main wallet (deployer, factory owner, gas sponsor), Mining POL on Polygon Amoy guide (+3 more)

### Community 60 - "donations/[id]/page.tsx"
Cohesion: 0.27
Nodes (7): DonationPage(), dynamic, metadata, DonationProgress(), STAGE_TEXT, EXPLORER_BASE_URL, explorerTxUrl()

### Community 61 - "DonatePanel.tsx"
Cohesion: 0.22
Nodes (6): DonateState, QUICK_AMOUNTS, CreateDonationInput, createDonationSchema, MAX_DONATION_MINOR_UNITS, MIN_DONATION_MINOR_UNITS

### Community 62 - "promote-admin.mjs"
Cohesion: 0.20
Nodes (8): args, db, dbFile, demote, email, emailHash, user, better-sqlite3

### Community 63 - "runtime.ts"
Cohesion: 0.29
Nodes (6): globalForSync, resetSyncState(), SyncState, KEYS, saved, SyncResult

### Community 64 - "Open items"
Cohesion: 0.25
Nodes (8): CampaignFactory contract, CampaignVault contract, Factory campaigns 0-3 bound to placeholder manager (demo-only), Blocking real (non-demo) use, Cost and operations, Open items, Product decisions to revisit, Testing and tooling gaps

### Community 65 - "2. Daily loop (repeat each day)"
Cohesion: 0.29
Nodes (7): 2. Daily loop (repeat each day), Step 1 — Create a temp wallet, Step 2 — Claim POL from the faucet, Step 3 — Check the temp wallet balance, Step 4 — Sweep the temp wallet into the main wallet, Step 5 — Check the main wallet balance, Step 6 — Clean up

### Community 66 - "VERA MVP — Progress Log"
Cohesion: 0.33
Nodes (6): Current status, Deployed on Polygon Amoy (chain 80002), Environment and gotchas, Next step, VERA MVP — Progress Log, Working agreement

### Community 67 - "RoleManager.tsx"
Cohesion: 0.40
Nodes (3): ROLE_LABEL, RoleManager(), SYNC_LABEL

### Community 68 - "Gas-price guard (150 gwei refusal, gasPriceRefusal)"
Cohesion: 0.40
Nodes (5): Gas-price guard (150 gwei refusal, gasPriceRefusal), Check gas price before deployment (cap 60 gwei), MilestoneManager deployment (block 47997230), Sponsor wallet drain incident (570 gwei spike), Testnet POL spending rule

## Knowledge Gaps
- **352 isolated node(s):** `metadata`, `metadata`, `metadata`, `STATUSES`, `balanceMock` (+347 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 435 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `History` connect `History` to `VERA MVP — Progress Log`, `dashboard.ts`, `queries.ts`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `VERA MVP — Progress Log` connect `VERA MVP — Progress Log` to `Open items`, `History`, `MilestoneManager contract`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Why does `PROGRESS_LOG` connect `MilestoneManager contract` to `VERA MVP — Progress Log`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **What connects `metadata`, `metadata`, `metadata` to the rest of the system?**
  _352 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getDb` be split into smaller, more focused modules?**
  _Cohesion score 0.05298885511651469 - nodes in this community are weakly interconnected._
- **Should `escrow/service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1452991452991453 - nodes in this community are weakly interconnected._
- **Should `getEnv` be split into smaller, more focused modules?**
  _Cohesion score 0.06766917293233082 - nodes in this community are weakly interconnected._