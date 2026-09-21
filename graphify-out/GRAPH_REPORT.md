# Graph Report - vera-mvp  (2026-09-19)

## Corpus Check
- 167 files · ~82,891 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 997 nodes · 2654 edges · 51 communities (43 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.83)
- Token cost: 80,112 input · 0 output

## Community Hubs (Navigation)
- getDb()
- escrow/service.ts
- CampaignForm.tsx
- getEnv()
- donations/service.ts
- MilestoneManager contract
- users.ts
- organizers/service.ts
- CampaignVault.sol (escrow)
- campaign.ts
- queries.ts
- indexer.integration.test.ts
- next
- FakeEscrowChain
- dashboard.ts
- runtime.ts
- Mining POL on Polygon Amoy — Step-by-Ste
- session.ts
- compilerOptions
- package.json
- web/package.json
- admin/page.tsx
- AuthForm.tsx
- LedgerDashboard.tsx
- devDependencies
- compilerOptions
- organizer/page.tsx
- dependencies
- types/package.json
- attestor/page.tsx
- page-guard.ts
- FakeChain
- ChainReader
- scripts
- History
- Module 2.1 Campaign Creation
- account/page.tsx
- contracts/package.json
- layout.tsx
- Module 3.2 Milestone State Machine & Mul
- eslint.config.mjs
- zod
- Layered Architecture L0-L3
- VERA MVP Functional Roadmap
- apps/web pnpm-workspace.yaml (sharp/unrs
- postcss.config.mjs
- Module 4.1 Beneficiary Uniqueness Regist
- Module 4.3 Security Review & Reconciliat
- Git rule: never commit or push
- MockINR (mINR) token
- contracts remappings.txt

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 82 edges
2. `apiError()` - 53 edges
3. `getEnv()` - 37 edges
4. `requireUser()` - 35 edges
5. `next` - 30 edges
6. `getCampaign()` - 25 edges
7. `vitest` - 21 edges
8. `Db` - 20 edges
9. `drizzle-orm` - 20 edges
10. `escrowChain()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `2026-09-19 — Review, remediation, and Step 3 completion` --references--> `createCampaign()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/campaigns/service.ts
- `2026-09-19 - RPC fallback for the web app` --references--> `parseRpcUrls()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/env.ts
- `Cost and operations` --references--> `syncIfStale()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/indexer/runtime.ts
- `2026-09-19 - Step 8: Indexing core events` --references--> `FakeChain`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/indexer/fake-chain.ts
- `2026-09-19 - Step 8: Indexing core events` --references--> `syncIfStale()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/indexer/runtime.ts

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

## Communities (51 total, 8 thin omitted)

### Community 0 - "getDb()"
Cohesion: 0.06
Nodes (87): GET(), STATUSES, POST(), balanceMock, ENC_KEY, post(), signUp(), userRow() (+79 more)

### Community 1 - "escrow/service.ts"
Cohesion: 0.07
Nodes (58): liveCampaign(), GET(), PublicUser, CampaignNotFoundError, CampaignWithMilestones, ChainStatus, createCampaign(), recordVaultDeploy() (+50 more)

### Community 2 - "CampaignForm.tsx"
Cohesion: 0.06
Nodes (44): CampaignsIndexPage(), dynamic, metadata, CampaignsPage(), metadata, blankMilestone, CampaignForm(), onSubmit() (+36 more)

### Community 3 - "getEnv()"
Cohesion: 0.08
Nodes (44): formatRupees(), MINR_DECIMALS, deployCampaignVault(), DeployVaultParams, factoryAbi, failed(), transport(), createDonationChain() (+36 more)

### Community 4 - "donations/service.ts"
Cohesion: 0.06
Nodes (33): DonationRow, donations, acquire(), advanceDonation(), AdvanceOptions, fail(), hashOf(), hashPatch() (+25 more)

### Community 5 - "MilestoneManager contract"
Cohesion: 0.05
Nodes (43): VERA web app README, Auto-release limit (100 mINR) and council threshold (3), CampaignFactory contract, CampaignVault contract, Chain operations never throw; DB record saved first, Deployed addresses on Polygon Amoy, Donation resumable state machine, Escrow services (lib/escrow: service, attestationCollector, councilWorkflow) (+35 more)

### Community 6 - "users.ts"
Cohesion: 0.08
Nodes (32): decryptSecret(), encryptSecret(), hashEmail(), normalizeEmail(), KEY, DUMMY_HASH, hashPassword(), MIN_PASSWORD_LENGTH (+24 more)

### Community 7 - "organizers/service.ts"
Cohesion: 0.09
Nodes (29): POST(), POST(), dynamic, OrganizerPublicPage(), ChainSyncResult, factoryAbi, syncOrganizerVerification(), transport() (+21 more)

### Community 8 - "CampaignVault.sol (escrow)"
Cohesion: 0.07
Nodes (38): VERA MVP SPDD, On-Chain Admin-Expense Ceiling, Admin Role Has No Fund-Transfer Capability, REST API v1 Design, Auto-Release vs Council-Approval Branching, BeneficiaryRegistry.sol, CampaignFactory.sol, CampaignVault.sol (escrow) (+30 more)

### Community 9 - "campaign.ts"
Cohesion: 0.08
Nodes (22): Beneficiary, Campaign, CampaignCategory, COMMUNITY, DISASTER_RELIEF, MEDICAL, CampaignStatus, COMPLETED (+14 more)

### Community 10 - "queries.ts"
Cohesion: 0.14
Nodes (17): GET(), ChainEventRow, chainEvents, indexerCursors, ACTOR_KEY, LedgerEntry, reconcileVault(), ReconciliationRow (+9 more)

### Community 11 - "indexer.integration.test.ts"
Cohesion: 0.14
Nodes (16): ENC_KEY, shared, attested(), created(), donation(), DONOR, FACTORY, MANAGER (+8 more)

### Community 12 - "next"
Cohesion: 0.16
Nodes (13): CampaignDetailPage(), CHAIN_COPY, dynamic, ActionButton(), AttestForm(), hashFile(), CardMode, KIND_LABEL (+5 more)

### Community 13 - "FakeEscrowChain"
Cohesion: 0.22
Nodes (8): ChainStatus, MilestoneState, OnSent, Signer, Tx, TxState, FakeEscrowChain, FakeMilestone

### Community 14 - "dashboard.ts"
Cohesion: 0.23
Nodes (14): GET(), DashboardData, goalReachedBps(), data, csvField(), exportFileName(), HEADER, ledgerToCsv() (+6 more)

### Community 15 - "runtime.ts"
Cohesion: 0.21
Nodes (15): GET(), GET(), CampaignPage(), dynamic, generateMetadata(), buildDashboard(), getCampaign(), IndexerStatus (+7 more)

### Community 16 - "Mining POL on Polygon Amoy — Step-by-Ste"
Cohesion: 0.10
Nodes (20): Faucet mining guide, 0. Main wallet details (the destination), 1.1 Network settings (RPC URL, chain ID, etc.), 1.2 Set the RPC for your terminal session, 1.3 The project's own RPC setting (for contract work), 1.4 (Optional) Add Amoy to MetaMask, 1.5 Make a safe folder for temp-wallet keys, 1. One-time setup (+12 more)

### Community 17 - "session.ts"
Cohesion: 0.21
Nodes (14): POST(), GET(), getRequestUser(), clearSessionCookieHeader(), cookieAttributes(), key(), readSessionCookie(), Role (+6 more)

### Community 18 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 19 - "package.json"
Cohesion: 0.12
Nodes (16): description, devEngines, packageManager, name, name, onFail, version, private (+8 more)

### Community 20 - "web/package.json"
Cohesion: 0.12
Nodes (14): typescript, name, private, version, drizzle-kit, jose, react-dom, tailwindcss (+6 more)

### Community 21 - "admin/page.tsx"
Cohesion: 0.16
Nodes (10): GET(), AdminPage(), metadata, AdminReviewList(), CHAIN_LABEL, ReviewItem, ROLE_LABEL, RoleManager() (+2 more)

### Community 22 - "AuthForm.tsx"
Cohesion: 0.18
Nodes (6): metadata, metadata, AuthForm(), COPY, FieldErrors, Mode

### Community 23 - "LedgerDashboard.tsx"
Cohesion: 0.29
Nodes (7): LedgerDashboard(), milestoneProgress(), useLiveData(), formatBps(), formatUtc(), MONTHS, shortAddress()

### Community 24 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, drizzle-kit, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/better-sqlite3, @types/node (+4 more)

### Community 25 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck (+3 more)

### Community 26 - "organizer/page.tsx"
Cohesion: 0.24
Nodes (8): metadata, OrganizerPage(), STATUS_COPY, FieldErrors, OrganizerApplyForm(), onFile(), sha256Hex(), getProfileByUser()

### Community 27 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, bcryptjs, better-sqlite3, drizzle-orm, jose, next, react, react-dom (+3 more)

### Community 28 - "types/package.json"
Cohesion: 0.18
Nodes (10): devDependencies, typescript, typescript, main, name, private, scripts, typecheck (+2 more)

### Community 29 - "attestor/page.tsx"
Cohesion: 0.27
Nodes (8): AttestorPage(), dynamic, metadata, CouncilPage(), dynamic, metadata, MilestoneCard(), listMilestoneViews()

### Community 30 - "page-guard.ts"
Cohesion: 0.31
Nodes (7): metadata, NewCampaignPage(), DonationPage(), dynamic, metadata, requirePageOrganizer(), requirePageUser()

### Community 32 - "ChainReader"
Cohesion: 0.36
Nodes (4): message(), syncOnce(), syncStream(), ChainReader

### Community 33 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, admin:promote, build, db:generate, dev, lint, start, test (+1 more)

### Community 34 - "History"
Cohesion: 0.22
Nodes (9): 2026-09-19 — Faucet mining guide, 2026-09-19 — Review, remediation, and Step 3 completion, 2026-09-19 - RPC fallback for the web app, 2026-09-19 - Step 5: Donor Registration (FR-IDN-01), 2026-09-19 - Step 6: Mock Organizer KYB (FR-IDN-02), 2026-09-19 - Step 8: Indexing core events, 2026-09-19 - Step 9: Public Ledger Dashboard (FR-LDG-01), Earlier (from git history) (+1 more)

### Community 35 - "Module 2.1 Campaign Creation"
Cohesion: 0.25
Nodes (8): Fund figures written only by indexer, never by app, Three-layer defense-in-depth validation (UI, backend, contract), Module 1.3 Donor Identity & Onboarding, Module 1.4 Organizer Verification (Mock KYB), Module 2.1 Campaign Creation, Module 2.2 On-Chain Event Reading / Indexing, Module 2.3 Public Audit Dashboard, Module 3.1 Donation Flow (Simulated Funding)

### Community 36 - "account/page.tsx"
Cohesion: 0.38
Nodes (5): AccountPage(), loadBalance(), metadata, LogoutButton(), SESSION_COOKIE

### Community 37 - "contracts/package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, build, test, version

### Community 38 - "layout.tsx"
Cohesion: 0.33
Nodes (4): apps_web_app_globals, geistMono, geistSans, metadata

### Community 39 - "Module 3.2 Milestone State Machine & Mul"
Cohesion: 0.40
Nodes (5): Hard-coded admin-expense cap ceiling, M-of-N unique confirmations per milestone, Module 3.2 Milestone State Machine & Multi-Confirmation, Module 3.3 Attestation (Verification) Flow, Module 3.4 Multi-Party Council Approval

### Community 40 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 41 - "zod"
Cohesion: 0.50
Nodes (3): attestationSchema, roleSchema, zod

### Community 42 - "Layered Architecture L0-L3"
Cohesion: 0.50
Nodes (4): Defense-in-Depth Layers (client, API, DB, contract), Error-Flow Philosophy (funds stay locked on failure), Layered Architecture L0-L3, Public Testnet Ledger (Polygon Amoy / Sepolia)

### Community 43 - "VERA MVP Functional Roadmap"
Cohesion: 0.67
Nodes (3): VERA MVP Functional Roadmap, Module 1.1 Project Foundation & Shared Vocabulary, Module 1.2 Core On-Chain Escrow Skeleton

## Knowledge Gaps
- **308 isolated node(s):** `AdminProfileView`, `PublicOrganizerProfile`, `DecisionInput`, `GeneratedWallet`, `FieldErrors` (+303 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 373 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `CampaignForm.tsx`, `account/page.tsx`, `layout.tsx`, `organizers/service.ts`, `runtime.ts`, `web/package.json`, `admin/page.tsx`, `AuthForm.tsx`, `LedgerDashboard.tsx`, `organizer/page.tsx`, `attestor/page.tsx`, `page-guard.ts`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `History` connect `History` to `CampaignForm.tsx`, `MilestoneManager contract`, `organizers/service.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `VERA MVP — Progress Log` connect `MilestoneManager contract` to `History`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `AdminProfileView`, `PublicOrganizerProfile`, `DecisionInput` to the rest of the system?**
  _308 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getDb()` be split into smaller, more focused modules?**
  _Cohesion score 0.05970944955351193 - nodes in this community are weakly interconnected._
- **Should `escrow/service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07459207459207459 - nodes in this community are weakly interconnected._
- **Should `CampaignForm.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.060451977401129946 - nodes in this community are weakly interconnected._