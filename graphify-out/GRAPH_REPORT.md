# Graph Report - vera-mvp  (2026-09-29)

## Corpus Check
- 83 files · ~125,963 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1252 nodes · 3450 edges · 77 communities (69 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 63 edges (avg confidence: 0.84)
- Token cost: 168,067 input · 0 output

## Community Hubs (Navigation)
- Escrow/Beneficiary/Disbursement Services
- Donations Engine & Tests
- Beneficiary Registration UI & Hashing
- Core Contracts & Fraud Evidence
- Validation Schemas & File Storage
- Escrow Routes & Live Chain Tests
- Public Ledger & Reconciliation
- Shared Domain Types (@vera/types)
- Indexer Runtime & Campaign Page
- Chain Ports & Fake Chains
- Manual Test Guide Walkthrough
- Campaign Routes & DB Access
- Chain Env Config & Balance
- Organizer Decision & Chain Sync
- API Guards, Errors & Routes
- Indexer Integration Tests
- Campaign Form & Validation
- Dashboard Pages & Page Guards
- Donation Advance & Gas Sponsor
- Donate Panel & Payout Form
- Deployed Contracts & Hardening Runbook
- Web TSConfig
- Route Guards & Indexer Sync
- Organizer Verify Route Tests
- Web Package Dependencies
- Root Workspace Package Config
- Auth Session & Organizer Page
- Beneficiary/Document Route Tests
- Auth Validation & Password Hashing
- Core Project Docs Index
- Auth Routes & Rate Limiting
- Ledger Export (CSV/JSON)
- Admin Console & Role Manager
- Organizer Campaign Detail Page
- Indexer Store & Sync Types
- Login/Register Forms
- Ledger Dashboard Formatting
- Donation Receipt & Explorer Links
- Fake Disbursement Chain
- Chain Reader Event Streams
- Web Dev Dependencies
- Disbursement Feature Overview
- Mining POL Guide Setup
- Types Package TSConfig
- Campaign Chain Deploy Helpers
- Escrow Chain Port Interface
- Fake Chain Event Reader
- Web Runtime Dependencies
- Progress Log Structure
- Types Package Config
- Auth Register/Login Routes
- Manager Chain Module
- Public Campaigns List Page
- Wallet Crypto & Email Hashing
- Disbursement Chain Module
- Web NPM Scripts
- Admin Promote CLI Script
- Progress Log History Entries
- VERA Vision & Value Props
- Roadmap Phase 1-3 Modules
- Contracts Package Scripts
- Daily POL Mining Loop
- Account Page & Logout
- Root Layout & Fonts
- Beneficiary Registry Chain Module
- Roadmap Milestone/Council Modules
- Campaign Form Component Logic
- ESLint Config
- Uploaded Documents Feature
- Sponsor Wallet & Donation Flow
- Layered Architecture & Defense-in-Depth
- Functional Roadmap Overview
- PNPM Workspace Config
- PostCSS Config
- Roadmap Phase 4 Modules
- Contracts Remappings
- Error Envelope Pattern

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 98 edges
2. `apiError()` - 64 edges
3. `getEnv()` - 44 edges
4. `requireUser()` - 43 edges
5. `next` - 33 edges
6. `drizzle-orm` - 31 edges
7. `vitest` - 30 edges
8. `Db` - 25 edges
9. `getCampaign()` - 25 edges
10. `viem` - 23 edges

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
- **Milestone release pipeline (attestation, state machine, council approval)** — docs_vera_mvp_functional_roadmap_module_3_3, docs_vera_mvp_functional_roadmap_module_3_2, docs_vera_mvp_functional_roadmap_module_3_4 [EXTRACTED 0.95]
- **Donate-to-Disburse Escrow Flow** — docs_vera_mvp_spdd_campaignvault, docs_vera_mvp_spdd_milestonemanager, docs_vera_mvp_spdd_trusted_attestor, docs_vera_mvp_spdd_council_multisig, docs_vera_mvp_spdd_disbursement [EXTRACTED 1.00]
- **VERA On-Chain Contract Suite** — docs_vera_mvp_spdd_campaignfactory, docs_vera_mvp_spdd_campaignvault, docs_vera_mvp_spdd_milestonemanager, docs_vera_mvp_spdd_beneficiaryregistry, docs_vera_mvp_spdd_disbursement, docs_vera_mvp_spdd_mockusdc [EXTRACTED 1.00]
- **Chain-to-dashboard transparency flow (indexing, dashboard, reconciliation)** — docs_vera_mvp_functional_roadmap_module_2_2, docs_vera_mvp_functional_roadmap_module_2_3, docs_vera_mvp_functional_roadmap_module_4_3 [INFERRED 0.85]
- **Free Replacements for Deferred Primitives** — docs_vera_mvp_spdd_trusted_attestor, docs_vera_mvp_spdd_hash_commitment_dedup, docs_vera_mvp_spdd_simulated_ramps, docs_vera_mvp_spdd_deferred_features [INFERRED 0.85]
- **Fund release and payout pipeline (MilestoneManager -> CampaignVault -> BeneficiaryRegistry -> Disbursement)** — claude_milestonemanager, claude_campaignvault, claude_beneficiaryregistry, claude_disbursement [EXTRACTED 1.00]
- **Testnet POL/gas discipline across deployment and testing docs** — claude_testnet_pol_rule, docs_mining_instructions_gas_price_check, docs_progress_log_gas_spike_incident [INFERRED 0.85]
- **Multi-party verification and governance (attestors + council) gating milestone release** — docs_project_overview_multi_attestor, docs_project_overview_governance_council, claude_milestonemanager [EXTRACTED 1.00]

## Communities (77 total, 8 thin omitted)

### Community 0 - "Escrow/Beneficiary/Disbursement Services"
Cohesion: 0.05
Nodes (84): cookieFor(), released(), shared, GET(), findUserById(), getWalletKeyEnc(), PublicUser, toPublicUser() (+76 more)

### Community 1 - "Donations Engine & Tests"
Cohesion: 0.05
Nodes (46): cookieFor(), ctx(), drive(), req(), shared, start(), generateMetadata(), DonationPage() (+38 more)

### Community 2 - "Beneficiary Registration UI & Hashing"
Cohesion: 0.07
Nodes (32): BeneficiariesPage(), dynamic, metadata, short(), STATUS_COPY, AttestForm(), BeneficiaryForm(), submit() (+24 more)

### Community 3 - "Core Contracts & Fraud Evidence"
Cohesion: 0.07
Nodes (38): VERA MVP SPDD, On-Chain Admin-Expense Ceiling, Admin Role Has No Fund-Transfer Capability, REST API v1 Design, Auto-Release vs Council-Approval Branching, BeneficiaryRegistry.sol, CampaignFactory.sol, CampaignVault.sol (escrow) (+30 more)

### Community 4 - "Validation Schemas & File Storage"
Cohesion: 0.08
Nodes (24): makeDoc(), makeUser(), RegisterBeneficiaryInput, registerBeneficiarySchema, DocumentRow, documents, DisburseInput, disburseSchema (+16 more)

### Community 5 - "Escrow Routes & Live Chain Tests"
Cohesion: 0.14
Nodes (22): GET(), POST(), POST(), actor(), cookieFor(), ctx(), grant(), liveAndDefined() (+14 more)

### Community 6 - "Public Ledger & Reconciliation"
Cohesion: 0.15
Nodes (22): GET(), GET(), buildDashboard(), goalReachedBps(), ACTOR_KEY, checkPayouts(), HAS_AMOUNT, IndexerStatus (+14 more)

### Community 7 - "Shared Domain Types (@vera/types)"
Cohesion: 0.08
Nodes (22): Beneficiary, Campaign, CampaignCategory, COMMUNITY, DISASTER_RELIEF, MEDICAL, CampaignStatus, COMPLETED (+14 more)

### Community 8 - "Indexer Runtime & Campaign Page"
Cohesion: 0.11
Nodes (20): GET(), CampaignPage(), dynamic, DonateState, getOptionalPageUser(), beneficiaryRegistered, campaignCreated, createChainReader() (+12 more)

### Community 9 - "Chain Ports & Fake Chains"
Cohesion: 0.23
Nodes (9): PayoutState, ChainStatus, MilestoneState, OnSent, Signer, Tx, TxState, FakeEscrowChain (+1 more)

### Community 10 - "Manual Test Guide Walkthrough"
Cohesion: 0.08
Nodes (25): 0. What you will have open, 10. Starting over, 11. Going back to normal (the real Amoy testnet), 12. Troubleshooting, 13. What this test does not prove, 1. Prerequisites (one-time), 2. Get the project ready (one-time), 3. Start the local blockchain (+17 more)

### Community 11 - "Campaign Routes & DB Access"
Cohesion: 0.14
Nodes (18): campaignInput, chain, createFor(), ENC_KEY, makeOrganizer(), makeUser(), req(), TestUser (+10 more)

### Community 12 - "Chain Env Config & Balance"
Cohesion: 0.13
Nodes (16): formatRupees(), getMinrBalance(), MINR_DECIMALS, ChainSyncResult, factoryAbi, transport(), GeneratedWallet, generateWallet() (+8 more)

### Community 13 - "Organizer Decision & Chain Sync"
Cohesion: 0.18
Nodes (17): POST(), POST(), GET(), STATUSES, syncOrganizerVerification(), OrganizerProfileRow, AdminProfileView, AlreadyReviewedError (+9 more)

### Community 14 - "API Guards, Errors & Routes"
Cohesion: 0.21
Nodes (14): GET(), POST(), GET(), POST(), GET(), POST(), apiError(), ErrorCode (+6 more)

### Community 15 - "Indexer Integration Tests"
Cohesion: 0.13
Nodes (18): ENC_KEY, shared, attested(), beneficiary(), created(), DISBURSEMENT, donation(), DONOR (+10 more)

### Community 16 - "Campaign Form & Validation"
Cohesion: 0.15
Nodes (16): dynamic, metadata, blankMilestone, FieldErrors, MilestoneDraft, CAMPAIGN_CATEGORIES, CATEGORY_ADMIN_CEILING_PCT, CATEGORY_LABEL (+8 more)

### Community 17 - "Dashboard Pages & Page Guards"
Cohesion: 0.16
Nodes (15): AttestorPage(), dynamic, metadata, metadata, NewCampaignPage(), CouncilPage(), dynamic, metadata (+7 more)

### Community 18 - "Donation Advance & Gas Sponsor"
Cohesion: 0.21
Nodes (15): POST(), createDonationChain(), donationsConfigured(), mockInrAbi, transport(), vaultAbi, gasPriceRefusal(), MAX_GAS_PRICE_WEI (+7 more)

### Community 19 - "Donate Panel & Payout Form"
Cohesion: 0.14
Nodes (11): DonatePanel(), QUICK_AMOUNTS, PayoutBeneficiary, PayoutForm(), short(), MINR_DECIMALS, rupeesToMinorUnits(), CreateDonationInput (+3 more)

### Community 20 - "Deployed Contracts & Hardening Runbook"
Cohesion: 0.13
Nodes (19): CampaignFactory contract, CampaignVault contract, Escrow: attestation, council, release (Steps 11-12), Web app event indexer, MilestoneManager contract, MockINR contract, VERA (Verified Escrow & Relief Architecture), Deploy.s.sol deployment script (+11 more)

### Community 21 - "Web TSConfig"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 22 - "Route Guards & Indexer Sync"
Cohesion: 0.25
Nodes (13): GET(), POST(), GET(), POST(), POST(), OrganizerPage(), readJson(), requireUser() (+5 more)

### Community 23 - "Organizer Verify Route Tests"
Cohesion: 0.16
Nodes (12): GET(), application, applyAs(), chain, DOC_HASH, ENC_KEY, makeUser(), req() (+4 more)

### Community 24 - "Web Package Dependencies"
Cohesion: 0.12
Nodes (15): typescript, name, private, version, better-sqlite3, drizzle-kit, jose, react-dom (+7 more)

### Community 25 - "Root Workspace Package Config"
Cohesion: 0.12
Nodes (16): description, devEngines, packageManager, name, name, onFail, version, private (+8 more)

### Community 26 - "Auth Session & Organizer Page"
Cohesion: 0.21
Nodes (12): POST(), GET(), metadata, STATUS_COPY, clearSessionCookieHeader(), cookieAttributes(), key(), readSessionCookie() (+4 more)

### Community 27 - "Beneficiary/Document Route Tests"
Cohesion: 0.15
Nodes (9): cookieFor(), setup(), shared, ENC_KEY, GET(), Role, resetDbForTests(), apps_web_lib_db_index_schema (+1 more)

### Community 28 - "Auth Validation & Password Hashing"
Cohesion: 0.16
Nodes (12): DUMMY_HASH, hashPassword(), MIN_PASSWORD_LENGTH, verifyPassword(), email, LoginInput, loginSchema, password (+4 more)

### Community 29 - "Core Project Docs Index"
Cohesion: 0.21
Nodes (12): CLAUDE.md (VERA project guide), Git no-commit rule, graphify knowledge graph, Progress log liveness rule, VERA_MVP_SPDD.md (design source of truth), Testnet POL scarcity rule, Faucet mining guide, Daily faucet-mine-and-sweep loop (+4 more)

### Community 30 - "Auth Routes & Rate Limiting"
Cohesion: 0.16
Nodes (11): balanceMock, ENC_KEY, post(), signUp(), userRow(), body(), H(), Bucket (+3 more)

### Community 31 - "Ledger Export (CSV/JSON)"
Cohesion: 0.30
Nodes (10): GET(), DashboardData, data, csvField(), exportFileName(), HEADER, ledgerToCsv(), ledgerToJson() (+2 more)

### Community 32 - "Admin Console & Role Manager"
Cohesion: 0.18
Nodes (9): AdminPage(), metadata, AdminReviewList(), CHAIN_LABEL, ReviewItem, ROLE_LABEL, RoleManager(), SYNC_LABEL (+1 more)

### Community 33 - "Organizer Campaign Detail Page"
Cohesion: 0.23
Nodes (10): CampaignDetailPage(), CHAIN_COPY, dynamic, ActionButton(), CardMode, KIND_LABEL, PublishCampaignButton(), getDisbursement() (+2 more)

### Community 34 - "Indexer Store & Sync Types"
Cohesion: 0.23
Nodes (10): ChainEventRow, chainEvents, indexerCursors, getCursor(), insertEvents(), knownVaults(), setCursor(), Fetch (+2 more)

### Community 35 - "Login/Register Forms"
Cohesion: 0.18
Nodes (6): metadata, metadata, AuthForm(), COPY, FieldErrors, Mode

### Community 36 - "Ledger Dashboard Formatting"
Cohesion: 0.26
Nodes (7): LedgerDashboard(), milestoneProgress(), useLiveData(), formatBps(), formatUtc(), MONTHS, shortAddress()

### Community 37 - "Donation Receipt & Explorer Links"
Cohesion: 0.21
Nodes (9): dynamic, metadata, DonationProgress(), retry(), STAGE_TEXT, EXPLORER_BASE_URL, explorerAddressUrl(), explorerTxUrl() (+1 more)

### Community 39 - "Chain Reader Event Streams"
Cohesion: 0.27
Nodes (4): message(), syncOnce(), syncStream(), ChainReader

### Community 40 - "Web Dev Dependencies"
Cohesion: 0.17
Nodes (12): devDependencies, drizzle-kit, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/better-sqlite3, @types/node (+4 more)

### Community 41 - "Disbursement Feature Overview"
Cohesion: 0.23
Nodes (12): admin:promote CLI script, PayoutForm.tsx (record payout UI), VERA web app (Next.js full-stack), Beneficiaries feature (Step 13), BeneficiaryRegistry contract, Disbursement contract, Disbursement feature (Step 14), Disbursement downstream-of-manager divergence (SPDD 18.4) (+4 more)

### Community 42 - "Mining POL Guide Setup"
Cohesion: 0.17
Nodes (12): 0. Main wallet details (the destination), 1.1 Network settings (RPC URL, chain ID, etc.), 1.2 Set the RPC for your terminal session, 1.3 The project's own RPC setting (for contract work), 1.4 (Optional) Add Amoy to MetaMask, 1.5 Make a safe folder for temp-wallet keys, 1. One-time setup, 3. Optional: log your running total (+4 more)

### Community 43 - "Types Package TSConfig"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck (+3 more)

### Community 44 - "Campaign Chain Deploy Helpers"
Cohesion: 0.27
Nodes (10): decryptSecret(), CampaignCategory, CATEGORY_ENUM_INDEX, ceilingFor(), VaultDeployResult, deployCampaignVault(), DeployVaultParams, factoryAbi (+2 more)

### Community 47 - "Web Runtime Dependencies"
Cohesion: 0.18
Nodes (11): dependencies, bcryptjs, better-sqlite3, drizzle-orm, jose, next, react, react-dom (+3 more)

### Community 48 - "Progress Log Structure"
Cohesion: 0.18
Nodes (11): Blocking real (non-demo) use, Cost and operations, Current status, Deployed on Polygon Amoy (chain 80002), Environment and gotchas, Next step, Open items, Product decisions to revisit (+3 more)

### Community 49 - "Types Package Config"
Cohesion: 0.18
Nodes (10): devDependencies, typescript, typescript, main, name, private, scripts, typecheck (+2 more)

### Community 50 - "Auth Register/Login Routes"
Cohesion: 0.42
Nodes (7): POST(), POST(), clientKey(), sessionCookieHeader(), signSession(), authenticate(), InvalidCredentialsError

### Community 51 - "Manager Chain Module"
Cohesion: 0.31
Nodes (9): createEscrowChain(), sendAs(), sendAsSponsor(), explain(), managerAbi, REASONS, STATUS, transport() (+1 more)

### Community 52 - "Public Campaigns List Page"
Cohesion: 0.33
Nodes (8): CampaignsIndexPage(), CampaignsPage(), metadata, formatMinorUnits(), listByOrganizer(), listLive(), milestonesFor(), toCampaign()

### Community 53 - "Wallet Crypto & Email Hashing"
Cohesion: 0.39
Nodes (6): encryptSecret(), hashEmail(), normalizeEmail(), KEY, EmailAlreadyRegisteredError, registerDonor()

### Community 54 - "Disbursement Chain Module"
Cohesion: 0.31
Nodes (8): createDisbursementChain(), send(), disbursementAbi, explainDisbursementError(), managerAbi, REASONS, tokenAbi, transport()

### Community 55 - "Web NPM Scripts"
Cohesion: 0.22
Nodes (9): scripts, admin:promote, build, db:generate, dev, lint, start, test (+1 more)

### Community 56 - "Admin Promote CLI Script"
Cohesion: 0.22
Nodes (7): args, db, dbFile, demote, email, emailHash, user

### Community 57 - "Progress Log History Entries"
Cohesion: 0.22
Nodes (9): 2026-09-19 — Faucet mining guide, 2026-09-19 — Review, remediation, and Step 3 completion, 2026-09-19 - RPC fallback for the web app, 2026-09-19 - Step 5: Donor Registration (FR-IDN-01), 2026-09-19 - Step 6: Mock Organizer KYB (FR-IDN-02), 2026-09-19 - Step 7: Campaign Creation (FR-CMP-01), 2026-09-19 - Step 8: Indexing core events, Earlier (from git history) (+1 more)

### Community 58 - "VERA Vision & Value Props"
Cohesion: 0.29
Nodes (7): The 'Black Box' problem in legacy charity, Assam Monsoon Emergency Relief 2026 (case scenario), Governance Council Oversight (K-of-L), Milestone-Gated Smart Escrow mechanism, Independent Multi-Attestor Verification (M-of-N), Hard-Coded Overhead Ceilings, VERA vision: milestone-gated escrow crowdfunding

### Community 59 - "Roadmap Phase 1-3 Modules"
Cohesion: 0.25
Nodes (8): Fund figures written only by indexer, never by app, Three-layer defense-in-depth validation (UI, backend, contract), Module 1.3 Donor Identity & Onboarding, Module 1.4 Organizer Verification (Mock KYB), Module 2.1 Campaign Creation, Module 2.2 On-Chain Event Reading / Indexing, Module 2.3 Public Audit Dashboard, Module 3.1 Donation Flow (Simulated Funding)

### Community 60 - "Contracts Package Scripts"
Cohesion: 0.29
Nodes (6): name, private, scripts, build, test, version

### Community 61 - "Daily POL Mining Loop"
Cohesion: 0.29
Nodes (7): 2. Daily loop (repeat each day), Step 1 — Create a temp wallet, Step 2 — Claim POL from the faucet, Step 3 — Check the temp wallet balance, Step 4 — Sweep the temp wallet into the main wallet, Step 5 — Check the main wallet balance, Step 6 — Clean up

### Community 62 - "Account Page & Logout"
Cohesion: 0.47
Nodes (4): AccountPage(), loadBalance(), metadata, LogoutButton()

### Community 63 - "Root Layout & Fonts"
Cohesion: 0.33
Nodes (4): apps_web_app_globals, geistMono, geistSans, metadata

### Community 64 - "Beneficiary Registry Chain Module"
Cohesion: 0.40
Nodes (4): createBeneficiaryChain(), REASONS, registryAbi, transport()

### Community 65 - "Roadmap Milestone/Council Modules"
Cohesion: 0.40
Nodes (5): Hard-coded admin-expense cap ceiling, M-of-N unique confirmations per milestone, Module 3.2 Milestone State Machine & Multi-Confirmation, Module 3.3 Attestation (Verification) Flow, Module 3.4 Multi-Party Council Approval

### Community 66 - "Campaign Form Component Logic"
Cohesion: 0.67
Nodes (3): CampaignForm(), onSubmit(), payload()

### Community 67 - "ESLint Config"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 68 - "Uploaded Documents Feature"
Cohesion: 0.83
Nodes (4): Organizer KYB flow, Uploaded documents (KYB/evidence), Document-storage design reversal (hash-only to uploaded file), Uploaded Documents (KYB / Milestone Evidence)

### Community 69 - "Sponsor Wallet & Donation Flow"
Cohesion: 0.50
Nodes (4): Donation flow (Step 10), Sponsor wallet (gas sponsorship), Gas Sponsorship Engine (sponsor.ts), Client-Side Custodial Wallet Security (AES-256-GCM)

### Community 70 - "Layered Architecture & Defense-in-Depth"
Cohesion: 0.50
Nodes (4): Defense-in-Depth Layers (client, API, DB, contract), Error-Flow Philosophy (funds stay locked on failure), Layered Architecture L0-L3, Public Testnet Ledger (Polygon Amoy / Sepolia)

### Community 71 - "Functional Roadmap Overview"
Cohesion: 0.67
Nodes (3): VERA MVP Functional Roadmap, Module 1.1 Project Foundation & Shared Vocabulary, Module 1.2 Core On-Chain Escrow Skeleton

## Ambiguous Edges - Review These
- `Git no-commit rule` → `graphify knowledge graph`  [AMBIGUOUS]
  CLAUDE.md · relation: conceptually_related_to

## Knowledge Gaps
- **360 isolated node(s):** `TestUser`, `TestUser`, `Guarded`, `JsonResult`, `Bucket` (+355 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 464 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Git no-commit rule` and `graphify knowledge graph`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `VERA web app (Next.js full-stack)` connect `Disbursement Feature Overview` to `Escrow Routes & Live Chain Tests`, `Deployed Contracts & Hardening Runbook`, `Uploaded Documents Feature`, `Core Project Docs Index`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `next` connect `Dashboard Pages & Page Guards` to `Admin Console & Role Manager`, `Organizer Campaign Detail Page`, `Beneficiary Registration UI & Hashing`, `Login/Register Forms`, `Ledger Dashboard Formatting`, `Donation Receipt & Explorer Links`, `Indexer Runtime & Campaign Page`, `Campaign Routes & DB Access`, `Campaign Form & Validation`, `Donate Panel & Payout Form`, `Public Campaigns List Page`, `Web Package Dependencies`, `Auth Session & Organizer Page`, `Account Page & Logout`, `Root Layout & Fonts`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `drizzle-orm` connect `Escrow/Beneficiary/Disbursement Services` to `Organizer Campaign Detail Page`, `Donations Engine & Tests`, `Indexer Store & Sync Types`, `Validation Schemas & File Storage`, `Escrow Routes & Live Chain Tests`, `Campaign Routes & DB Access`, `Organizer Decision & Chain Sync`, `Indexer Integration Tests`, `Organizer Verify Route Tests`, `Web Package Dependencies`, `Beneficiary/Document Route Tests`, `Auth Routes & Rate Limiting`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `TestUser`, `TestUser`, `Guarded` to the rest of the system?**
  _360 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Escrow/Beneficiary/Disbursement Services` be split into smaller, more focused modules?**
  _Cohesion score 0.05415713196033562 - nodes in this community are weakly interconnected._
- **Should `Donations Engine & Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.05333333333333334 - nodes in this community are weakly interconnected._