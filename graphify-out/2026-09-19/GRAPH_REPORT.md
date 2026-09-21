# Graph Report - vera-mvp  (2026-09-19)

## Corpus Check
- 127 files · ~64,500 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 852 nodes · 2118 edges · 43 communities (40 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.83)
- Token cost: 74,862 input · 0 output

## Community Hubs (Navigation)
- API Core, DB & Organizer Logic
- Auth, Sessions & Account
- Donations & Campaign Services
- Indexer & Public Dashboard Data
- Config & Chain Access
- SPDD Contracts & Fraud Case Design
- Shared Types Package
- Campaign Pages & Page Guards
- Donation Chain Port & Fake Chain
- Progress Log History
- Campaign Form & Validation
- Web Dev Tooling Config
- Web tsconfig
- Campaign Page & Donate Panel
- Ledger Dashboard & Progress UI
- Root Package Config
- Auth Forms & Pages
- Project Status & Wallet Roles
- Web Dev Dependencies
- Admin Promote Script
- Types Package tsconfig
- Web Runtime Dependencies
- Types Package Manifest
- Organizer Apply & Publish UI
- Web Package Scripts
- Docs Set (Logs, READMEs, SPDD)
- Money Helpers & Campaign Form
- Vault, Manager & Deployments
- Roadmap Modules 1-2
- Contracts Package Scripts
- Mining Daily Loop
- App Layout & Globals
- Mining Guide Overview
- Mining Setup & RPC
- Indexer & Reconciliation Rules
- Roadmap Module 3 Milestones
- Project & Workspace Overview
- Architecture Layers & Defense in Depth
- Donor Wallets & Auth Notes
- Roadmap Foundation Modules
- PostCSS Config
- Roadmap Module 4 Beneficiaries
- Roadmap Security & Reconciliation

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 77 edges
2. `apiError()` - 42 edges
3. `getEnv()` - 33 edges
4. `requireUser()` - 30 edges
5. `next` - 24 edges
6. `getCampaign()` - 23 edges
7. `registerDonor()` - 18 edges
8. `IndexerRuntime` - 18 edges
9. `findUserById()` - 17 edges
10. `buildDashboard()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Cost and operations` --references--> `syncIfStale()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/indexer/runtime.ts
- `2026-09-19 - RPC fallback for the web app` --references--> `parseRpcUrls()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/env.ts
- `2026-09-19 — Review, remediation, and Step 3 completion` --references--> `createCampaign()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/campaigns/service.ts
- `2026-09-19 - Step 7: Campaign Creation (FR-CMP-01)` --references--> `requireVerifiedOrganizer()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/organizers/service.ts
- `2026-09-19 - Step 8: Indexing core events` --references--> `FakeChain`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/indexer/fake-chain.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Milestone release pipeline (attestation, state machine, council approval)** — docs_vera_mvp_functional_roadmap_module_3_3, docs_vera_mvp_functional_roadmap_module_3_2, docs_vera_mvp_functional_roadmap_module_3_4 [EXTRACTED 0.95]
- **Donate-to-Disburse Escrow Flow** — docs_vera_mvp_spdd_campaignvault, docs_vera_mvp_spdd_milestonemanager, docs_vera_mvp_spdd_trusted_attestor, docs_vera_mvp_spdd_council_multisig, docs_vera_mvp_spdd_disbursement [EXTRACTED 1.00]
- **VERA On-Chain Contract Suite** — docs_vera_mvp_spdd_campaignfactory, docs_vera_mvp_spdd_campaignvault, docs_vera_mvp_spdd_milestonemanager, docs_vera_mvp_spdd_beneficiaryregistry, docs_vera_mvp_spdd_disbursement, docs_vera_mvp_spdd_mockusdc [EXTRACTED 1.00]
- **Chain-to-dashboard transparency flow (indexing, dashboard, reconciliation)** — docs_vera_mvp_functional_roadmap_module_2_2, docs_vera_mvp_functional_roadmap_module_2_3, docs_vera_mvp_functional_roadmap_module_4_3 [INFERRED 0.85]
- **Free Replacements for Deferred Primitives** — docs_vera_mvp_spdd_trusted_attestor, docs_vera_mvp_spdd_hash_commitment_dedup, docs_vera_mvp_spdd_simulated_ramps, docs_vera_mvp_spdd_deferred_features [INFERRED 0.85]
- **Donation flow money-safety rules** — docs_progress_log_step_10_donation_flow, docs_progress_log_tx_hash_before_wait, docs_progress_log_pending_never_done, docs_progress_log_sign_as_organizer, docs_progress_log_checksum_config [EXTRACTED 1.00]
- **Chain-derived public ledger trust stack** — docs_progress_log_indexer, docs_progress_log_public_dashboard, docs_progress_log_reconciliation, docs_progress_log_money_never_stored [EXTRACTED 1.00]
- **VERA escrow contract suite** — claude_mockinr, claude_campaignfactory, claude_campaignvault, claude_milestonemanager [EXTRACTED 1.00]

## Communities (43 total, 3 thin omitted)

### Community 0 - "API Core, DB & Organizer Logic"
Cohesion: 0.06
Nodes (76): POST(), POST(), GET(), STATUSES, campaignInput, chain, createFor(), ENC_KEY (+68 more)

### Community 1 - "Auth, Sessions & Account"
Cohesion: 0.05
Nodes (63): AccountPage(), loadBalance(), metadata, balanceMock, ENC_KEY, post(), signUp(), userRow() (+55 more)

### Community 2 - "Donations & Campaign Services"
Cohesion: 0.05
Nodes (69): POST(), cookieFor(), ctx(), drive(), req(), shared, start(), GET() (+61 more)

### Community 3 - "Indexer & Public Dashboard Data"
Cohesion: 0.07
Nodes (54): GET(), ENC_KEY, shared, GET(), GET(), buildDashboard(), DashboardData, goalReachedBps() (+46 more)

### Community 4 - "Config & Chain Access"
Cohesion: 0.10
Nodes (35): decryptSecret(), ceilingFor(), getMinrBalance(), MINR_DECIMALS, deployCampaignVault(), factoryAbi, failed(), transport() (+27 more)

### Community 5 - "SPDD Contracts & Fraud Case Design"
Cohesion: 0.07
Nodes (37): On-Chain Admin-Expense Ceiling, Admin Role Has No Fund-Transfer Capability, REST API v1 Design, Auto-Release vs Council-Approval Branching, BeneficiaryRegistry.sol, CampaignFactory.sol, CampaignVault.sol (escrow), Ground-Truth Fraud Case Evidence (Ayodhya, Feeding Our Future, FireAid, SantaCon, GoFundMe, Mumbai, Women's Cancer Fund) (+29 more)

### Community 6 - "Shared Types Package"
Cohesion: 0.08
Nodes (22): Beneficiary, Campaign, CampaignCategory, COMMUNITY, DISASTER_RELIEF, MEDICAL, CampaignStatus, COMPLETED (+14 more)

### Community 7 - "Campaign Pages & Page Guards"
Cohesion: 0.14
Nodes (17): CampaignsIndexPage(), dynamic, metadata, CampaignDetailPage(), CHAIN_COPY, dynamic, metadata, NewCampaignPage() (+9 more)

### Community 8 - "Donation Chain Port & Fake Chain"
Cohesion: 0.14
Nodes (5): sendStep(), DonationChain, ReceiptState, SendParams, FakeDonationChain

### Community 9 - "Progress Log History"
Cohesion: 0.09
Nodes (23): retry(), createCampaign(), Git rule: never commit or push, 2026-09-19 — Faucet mining guide, 2026-09-19 — Review, remediation, and Step 3 completion, 2026-09-19 - RPC fallback for the web app, 2026-09-19 - Step 10: Donation flow / simulated on-ramp (FR-CMP-02), 2026-09-19 - Step 5: Donor Registration (FR-IDN-01) (+15 more)

### Community 10 - "Campaign Form & Validation"
Cohesion: 0.16
Nodes (16): blankMilestone, FieldErrors, MilestoneDraft, CAMPAIGN_CATEGORIES, CampaignCategory, CATEGORY_ADMIN_CEILING_PCT, CATEGORY_ENUM_INDEX, baseSchema (+8 more)

### Community 11 - "Web Dev Tooling Config"
Cohesion: 0.11
Nodes (16): eslintConfig, name, private, version, drizzle-kit, eslint, eslint-config-next, jose (+8 more)

### Community 12 - "Web tsconfig"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "Campaign Page & Donate Panel"
Cohesion: 0.14
Nodes (12): CampaignPage(), dynamic, DonatePanel(), DonateState, QUICK_AMOUNTS, getOptionalPageUser(), donationsConfigured(), CreateDonationInput (+4 more)

### Community 14 - "Ledger Dashboard & Progress UI"
Cohesion: 0.22
Nodes (12): DonationProgress(), STAGE_TEXT, LedgerDashboard(), ReconciliationBadge(), useLiveData(), formatBps(), formatUtc(), MONTHS (+4 more)

### Community 15 - "Root Package Config"
Cohesion: 0.12
Nodes (16): description, devEngines, packageManager, name, name, onFail, version, private (+8 more)

### Community 16 - "Auth Forms & Pages"
Cohesion: 0.18
Nodes (6): metadata, metadata, AuthForm(), COPY, FieldErrors, Mode

### Community 17 - "Project Status & Wallet Roles"
Cohesion: 0.19
Nodes (13): admin:promote CLI, CampaignFactory contract, @vera/types shared package, Admin-cap category ceilings (10/15/20%), Main wallet (deployer, factory owner, gas sponsor), Temp wallet sweep procedure, Campaign creation (Step 7), Gas sponsor wallet (lib/chain/sponsor) (+5 more)

### Community 18 - "Web Dev Dependencies"
Cohesion: 0.17
Nodes (12): devDependencies, drizzle-kit, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/better-sqlite3, @types/node (+4 more)

### Community 19 - "Admin Promote Script"
Cohesion: 0.17
Nodes (10): args, db, dbFile, demote, email, emailHash, user, better-sqlite3 (+2 more)

### Community 20 - "Types Package tsconfig"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck (+3 more)

### Community 21 - "Web Runtime Dependencies"
Cohesion: 0.18
Nodes (11): dependencies, bcryptjs, better-sqlite3, drizzle-orm, jose, next, react, react-dom (+3 more)

### Community 22 - "Types Package Manifest"
Cohesion: 0.18
Nodes (10): devDependencies, typescript, typescript, main, name, private, scripts, typecheck (+2 more)

### Community 23 - "Organizer Apply & Publish UI"
Cohesion: 0.25
Nodes (6): FieldErrors, OrganizerApplyForm(), onFile(), sha256Hex(), PublishCampaignButton(), react

### Community 24 - "Web Package Scripts"
Cohesion: 0.22
Nodes (9): scripts, admin:promote, build, db:generate, dev, lint, start, test (+1 more)

### Community 25 - "Docs Set (Logs, READMEs, SPDD)"
Cohesion: 0.28
Nodes (9): web app README, Web app env configuration, Progress log must stay live, contracts README, contracts remappings.txt, Faucet mining guide, PROGRESS_LOG, Rule: checksum-validated config addresses (+1 more)

### Community 26 - "Money Helpers & Campaign Form"
Cohesion: 0.39
Nodes (5): CampaignForm(), onSubmit(), payload(), MINR_DECIMALS, rupeesToMinorUnits()

### Community 27 - "Vault, Manager & Deployments"
Cohesion: 0.29
Nodes (8): CampaignVault contract, Immutable milestoneManager binding, MilestoneManager (planned, Step 4), MockINR contract, Deployed addresses on Polygon Amoy, Placeholder milestone manager (deployer wallet), Open item: MilestoneReleased not emitted/indexable, Fixed critical vault setMilestoneManager bug

### Community 28 - "Roadmap Modules 1-2"
Cohesion: 0.25
Nodes (8): Fund figures written only by indexer, never by app, Three-layer defense-in-depth validation (UI, backend, contract), Module 1.3 Donor Identity & Onboarding, Module 1.4 Organizer Verification (Mock KYB), Module 2.1 Campaign Creation, Module 2.2 On-Chain Event Reading / Indexing, Module 2.3 Public Audit Dashboard, Module 3.1 Donation Flow (Simulated Funding)

### Community 29 - "Contracts Package Scripts"
Cohesion: 0.29
Nodes (6): name, private, scripts, build, test, version

### Community 30 - "Mining Daily Loop"
Cohesion: 0.29
Nodes (7): 2. Daily loop (repeat each day), Step 1 — Create a temp wallet, Step 2 — Claim POL from the faucet, Step 3 — Check the temp wallet balance, Step 4 — Sweep the temp wallet into the main wallet, Step 5 — Check the main wallet balance, Step 6 — Clean up

### Community 31 - "App Layout & Globals"
Cohesion: 0.33
Nodes (4): apps_web_app_globals, geistMono, geistSans, metadata

### Community 32 - "Mining Guide Overview"
Cohesion: 0.33
Nodes (6): 0. Main wallet details (the destination), 3. Optional: log your running total, 4. How much POL do you actually need?, 5. Troubleshooting, 6. Security rules, Mining POL on Polygon Amoy — Step-by-Step Guide

### Community 33 - "Mining Setup & RPC"
Cohesion: 0.33
Nodes (6): 1.1 Network settings (RPC URL, chain ID, etc.), 1.2 Set the RPC for your terminal session, 1.3 The project's own RPC setting (for contract work), 1.4 (Optional) Add Amoy to MetaMask, 1.5 Make a safe folder for temp-wallet keys, 1. One-time setup

### Community 34 - "Indexer & Reconciliation Rules"
Cohesion: 0.60
Nodes (5): Event indexer (lib/indexer), Rule: money never stored, chain-derived, Public ledger dashboard (Step 9), On-chain reconciliation check, RPC fallback list

### Community 35 - "Roadmap Module 3 Milestones"
Cohesion: 0.40
Nodes (5): Hard-coded admin-expense cap ceiling, M-of-N unique confirmations per milestone, Module 3.2 Milestone State Machine & Multi-Confirmation, Module 3.3 Attestation (Verification) Flow, Module 3.4 Multi-Party Council Approval

### Community 36 - "Project & Workspace Overview"
Cohesion: 0.50
Nodes (4): apps/web pnpm-workspace.yaml (sharp/unrs-resolver builds disabled), VERA_MVP_SPDD (source of truth), VERA MVP Project, pnpm workspace config

### Community 37 - "Architecture Layers & Defense in Depth"
Cohesion: 0.50
Nodes (4): Defense-in-Depth Layers (client, API, DB, contract), Error-Flow Philosophy (funds stay locked on failure), Layered Architecture L0-L3, Public Testnet Ledger (Polygon Amoy / Sepolia)

### Community 38 - "Donor Wallets & Auth Notes"
Cohesion: 0.67
Nodes (3): Generated donor wallets, Donor auth (Step 5), Open item: own-wallet users cannot sign (no SIWE)

### Community 39 - "Roadmap Foundation Modules"
Cohesion: 0.67
Nodes (3): VERA MVP Functional Roadmap, Module 1.1 Project Foundation & Shared Vocabulary, Module 1.2 Core On-Chain Escrow Skeleton

## Knowledge Gaps
- **279 isolated node(s):** `Beneficiary`, `Donation`, `name`, `private`, `build` (+274 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 332 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `History` connect `Progress Log History` to `Indexer & Public Dashboard Data`?**
  _High betweenness centrality (0.183) - this node is a cross-community bridge._
- **Why does `VERA MVP — Progress Log` connect `Progress Log History` to `Docs Set (Logs, READMEs, SPDD)`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Why does `PROGRESS_LOG` connect `Docs Set (Logs, READMEs, SPDD)` to `Progress Log History`, `Vault, Manager & Deployments`, `Project & Workspace Overview`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._
- **What connects `Beneficiary`, `Donation`, `name` to the rest of the system?**
  _279 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Core, DB & Organizer Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.057838123787691764 - nodes in this community are weakly interconnected._
- **Should `Auth, Sessions & Account` be split into smaller, more focused modules?**
  _Cohesion score 0.0506155950752394 - nodes in this community are weakly interconnected._
- **Should `Donations & Campaign Services` be split into smaller, more focused modules?**
  _Cohesion score 0.05335628227194492 - nodes in this community are weakly interconnected._