# Graph Report - vera-mvp  (2026-10-01)

## Corpus Check
- 233 files · ~151,504 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .sol 13, (none) 4, .example 1)

## Summary
- 1428 nodes · 4087 edges · 72 communities (62 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 78 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8a62c427`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- escrow/service.ts
- donations/service.ts
- BeneficiaryForm.tsx
- CampaignVault.sol (escrow)
- files/service.ts
- getDb
- dashboard.ts
- campaign.ts
- runtime.ts
- Tx
- Manual test guide: run and test VERA in your browser, for free
- beneficiary/service.ts
- Components
- organizers/service.ts
- Design System: VERA
- activity.test.ts
- CampaignForm.tsx
- councilWorkflow.ts
- getEnv
- next
- MilestoneManager contract
- compilerOptions
- disbursement/service.ts
- Product
- web/package.json
- package.json
- session.ts
- indexer.integration.test.ts
- users.ts
- PROGRESS_LOG
- zod
- export/route.ts
- Surface brief: VERA public surfaces and shared foundation
- dashboard/campaigns/[id]/page.tsx
- activity.ts
- AuthForm.tsx
- LedgerDashboard.tsx
- 2026-09-30T10-26-39Z__components-ledgerdashboard-tsx.md
- 2026-09-30T14-06-06Z__p-apps-web-components-ledgerdashboard-tsx-023165f9.md
- store.ts
- devDependencies
- Disbursement contract
- Mining POL on Polygon Amoy — Step-by-Step Guide
- compilerOptions
- 2026-10-01T09-55-30Z__p-apps-web-components-ledgerdashboard-tsx-023165f9.md
- EscrowChain
- FakeChain
- dependencies
- VERA MVP — Progress Log
- types/package.json
- 2026-10-01T10-20-42Z__p-apps-web-components-ledgerdashboard-tsx-023165f9.md
- formatMinorUnits
- scripts
- promote-admin.mjs
- disbursement.test.ts
- VERA vision: milestone-gated escrow crowdfunding
- Module 2.1 Campaign Creation
- contracts/package.json
- 2. Daily loop (repeat each day)
- roles.ts
- Module 3.2 Milestone State Machine & Multi-Confirmation
- PayoutForm.tsx
- eslint.config.mjs
- Organizer KYB flow
- VERA main/deployer/sponsor wallet
- Layered Architecture L0-L3
- VERA MVP Functional Roadmap
- apps/web pnpm-workspace.yaml (sharp/unrs-resolver builds disabled)
- postcss.config.mjs
- Module 4.1 Beneficiary Uniqueness Registry
- contracts remappings.txt
- Strict Error Envelope Pattern (SPDD 12.3)

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 124 edges
2. `apiError()` - 66 edges
3. `requireUser()` - 50 edges
4. `getEnv()` - 46 edges
5. `next` - 37 edges
6. `vitest` - 37 edges
7. `drizzle-orm` - 33 edges
8. `getCampaign()` - 30 edges
9. `Db` - 30 edges
10. `formatMinorUnits()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `2026-09-19 - RPC fallback for the web app` --references--> `parseRpcUrls()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/env.ts
- `Cost and operations` --references--> `syncIfStale()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/indexer/runtime.ts
- `2026-09-19 — Review, remediation, and Step 3 completion` --references--> `createCampaign()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/campaigns/service.ts
- `2026-09-19 - Step 8: Indexing core events` --references--> `syncIfStale()`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/indexer/runtime.ts
- `2026-09-19 - Step 8: Indexing core events` --references--> `ChainReader`  [INFERRED]
  docs/PROGRESS_LOG.md → apps/web/lib/indexer/types.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Milestone release pipeline (attestation, state machine, council approval)** — docs_vera_mvp_functional_roadmap_module_3_3, docs_vera_mvp_functional_roadmap_module_3_2, docs_vera_mvp_functional_roadmap_module_3_4 [EXTRACTED 0.95]
- **Fund release and payout pipeline (MilestoneManager -> CampaignVault -> BeneficiaryRegistry -> Disbursement)** — claude_milestonemanager, claude_campaignvault, claude_beneficiaryregistry, claude_disbursement [EXTRACTED 1.00]
- **Multi-party verification and governance (attestors + council) gating milestone release** — docs_project_overview_multi_attestor, docs_project_overview_governance_council, claude_milestonemanager [EXTRACTED 1.00]
- **Donate-to-Disburse Escrow Flow** — docs_vera_mvp_spdd_campaignvault, docs_vera_mvp_spdd_milestonemanager, docs_vera_mvp_spdd_trusted_attestor, docs_vera_mvp_spdd_council_multisig, docs_vera_mvp_spdd_disbursement [EXTRACTED 1.00]
- **VERA On-Chain Contract Suite** — docs_vera_mvp_spdd_campaignfactory, docs_vera_mvp_spdd_campaignvault, docs_vera_mvp_spdd_milestonemanager, docs_vera_mvp_spdd_beneficiaryregistry, docs_vera_mvp_spdd_disbursement, docs_vera_mvp_spdd_mockusdc [EXTRACTED 1.00]
- **Chain-to-dashboard transparency flow (indexing, dashboard, reconciliation)** — docs_vera_mvp_functional_roadmap_module_2_2, docs_vera_mvp_functional_roadmap_module_2_3, docs_vera_mvp_functional_roadmap_module_4_3 [INFERRED 0.85]
- **Testnet POL/gas discipline across deployment and testing docs** — claude_testnet_pol_rule, docs_mining_instructions_gas_price_check, docs_progress_log_gas_spike_incident [INFERRED 0.85]
- **Free Replacements for Deferred Primitives** — docs_vera_mvp_spdd_trusted_attestor, docs_vera_mvp_spdd_hash_commitment_dedup, docs_vera_mvp_spdd_simulated_ramps, docs_vera_mvp_spdd_deferred_features [INFERRED 0.85]

## Communities (72 total, 10 thin omitted)

### Community 0 - "escrow/service.ts"
Cohesion: 0.13
Nodes (26): CampaignNotFoundError, CampaignWithMilestones, ChainStatus, CampaignRow, campaigns, MilestoneActionRow, milestoneActions, MilestoneRow (+18 more)

### Community 1 - "donations/service.ts"
Cohesion: 0.07
Nodes (30): DonationPage(), DonationRow, donations, acquire(), advanceDonation(), AdvanceOptions, fail(), hashOf() (+22 more)

### Community 2 - "BeneficiaryForm.tsx"
Cohesion: 0.20
Nodes (15): AttestForm(), BeneficiaryForm(), submit(), Notice, short(), TONE, FieldErrors, OrganizerApplyForm() (+7 more)

### Community 3 - "CampaignVault.sol (escrow)"
Cohesion: 0.07
Nodes (37): On-Chain Admin-Expense Ceiling, Admin Role Has No Fund-Transfer Capability, REST API v1 Design, Auto-Release vs Council-Approval Branching, BeneficiaryRegistry.sol, CampaignFactory.sol, CampaignVault.sol (escrow), Ground-Truth Fraud Case Evidence (Ayodhya, Feeding Our Future, FireAid, SantaCon, GoFundMe, Mumbai, Women's Cancer Fund) (+29 more)

### Community 4 - "files/service.ts"
Cohesion: 0.11
Nodes (19): makeDoc(), DocumentRow, documents, attestationSchema, roleSchema, ALLOWED_DOCUMENT_MIME_TYPES, DocumentHashMismatchError, DocumentNotFoundError (+11 more)

### Community 5 - "getDb"
Cohesion: 0.07
Nodes (81): POST(), POST(), GET(), STATUSES, GET(), POST(), GET(), POST() (+73 more)

### Community 6 - "dashboard.ts"
Cohesion: 0.13
Nodes (24): generateMetadata(), buildDashboard(), classifyReconcileError(), goalReachedBps(), UnavailableReason, networkTotals, listLive(), milestonesFor() (+16 more)

### Community 7 - "campaign.ts"
Cohesion: 0.08
Nodes (22): Beneficiary, Campaign, CampaignCategory, COMMUNITY, DISASTER_RELIEF, MEDICAL, CampaignStatus, COMPLETED (+14 more)

### Community 8 - "runtime.ts"
Cohesion: 0.12
Nodes (22): GET(), GET(), CampaignPage(), dynamic, Home(), loadTotals(), StageKey, StageRail() (+14 more)

### Community 9 - "Tx"
Cohesion: 0.09
Nodes (17): FakeBeneficiaryChain, DisbursementChain, PayoutState, disburse(), FakeDisbursementChain, disburseMilestone(), fail(), isUniqueViolation() (+9 more)

### Community 10 - "Manual test guide: run and test VERA in your browser, for free"
Cohesion: 0.08
Nodes (25): 0. What you will have open, 10. Starting over, 11. Going back to normal (the real Amoy testnet), 12. Troubleshooting, 13. What this test does not prove, 1. Prerequisites (one-time), 2. Get the project ready (one-time), 3. Start the local blockchain (+17 more)

### Community 11 - "beneficiary/service.ts"
Cohesion: 0.11
Nodes (29): generateMetadata(), BeneficiariesPage(), dynamic, metadata, short(), STATUS_COPY, STATUS_DOT, STATUS_TONE (+21 more)

### Community 12 - "Components"
Cohesion: 0.07
Nodes (27): Buttons, Cards / Containers, Colors, Components, Design System: VERA, Do:, Do's and Don'ts, Don't: (+19 more)

### Community 13 - "organizers/service.ts"
Cohesion: 0.11
Nodes (22): campaignInput, chain, createFor(), ENC_KEY, makeOrganizer(), req(), TestUser, liveCampaign() (+14 more)

### Community 14 - "Design System: VERA"
Cohesion: 0.08
Nodes (23): Buttons, Cards / Containers, Colors, Components, Design System: VERA, Do:, Do's and Don'ts, Don't: (+15 more)

### Community 15 - "activity.test.ts"
Cohesion: 0.17
Nodes (22): shared, config, known, seed(), config, createDb(), attested(), beneficiary() (+14 more)

### Community 16 - "CampaignForm.tsx"
Cohesion: 0.17
Nodes (16): blankMilestone, FieldErrors, MilestoneDraft, CAMPAIGN_CATEGORIES, CampaignCategory, CATEGORY_ADMIN_CEILING_PCT, ceilingFor(), baseSchema (+8 more)

### Community 17 - "councilWorkflow.ts"
Cohesion: 0.40
Nodes (14): Prepared, prepareMilestone(), submitAttestation(), councilApprove(), releaseMilestone(), fail(), loadMilestone(), MilestoneView (+6 more)

### Community 18 - "getEnv"
Cohesion: 0.07
Nodes (60): decryptSecret(), CATEGORY_ENUM_INDEX, VaultDeployResult, deployCampaignVault(), factoryAbi, failed(), transport(), createDisbursementChain() (+52 more)

### Community 19 - "next"
Cohesion: 0.12
Nodes (14): dynamic, dynamic, metadata, DonatePanel(), DonateState, QUICK_AMOUNTS, DonationProgress(), STAGE_TEXT (+6 more)

### Community 20 - "MilestoneManager contract"
Cohesion: 0.15
Nodes (17): CampaignFactory contract, CampaignVault contract, Escrow: attestation, council, release (Steps 11-12), Web app event indexer, MilestoneManager contract, MockINR contract, VERA (Verified Escrow & Relief Architecture), Deploy.s.sol deployment script (+9 more)

### Community 21 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 22 - "disbursement/service.ts"
Cohesion: 0.18
Nodes (12): CampaignDetailPage(), PublicUser, Db, DisbursementRow, disbursements, UserRow, DisbursementFailure, DisbursementView (+4 more)

### Community 23 - "Product"
Cohesion: 0.18
Nodes (11): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+3 more)

### Community 24 - "web/package.json"
Cohesion: 0.12
Nodes (14): typescript, name, private, version, drizzle-kit, jose, react-dom, tailwindcss (+6 more)

### Community 25 - "package.json"
Cohesion: 0.12
Nodes (16): description, devEngines, packageManager, name, name, onFail, version, private (+8 more)

### Community 26 - "session.ts"
Cohesion: 0.05
Nodes (54): POST(), GET(), GET(), get(), AdminPage(), metadata, AttestorPage(), dynamic (+46 more)

### Community 27 - "indexer.integration.test.ts"
Cohesion: 0.10
Nodes (20): balanceMock, ENC_KEY, post(), signUp(), userRow(), ENC_KEY, body(), cookieFor() (+12 more)

### Community 28 - "users.ts"
Cohesion: 0.12
Nodes (29): POST(), POST(), makeUser(), makeUser(), makeUser(), clientKey(), encryptSecret(), hashEmail() (+21 more)

### Community 29 - "PROGRESS_LOG"
Cohesion: 0.18
Nodes (11): CLAUDE.md (VERA project guide), Git no-commit rule, graphify knowledge graph, Progress log liveness rule, VERA_MVP_SPDD.md (design source of truth), Testnet POL scarcity rule, Full manual browser walkthrough (8 accounts), Faucet mining guide (+3 more)

### Community 30 - "zod"
Cohesion: 0.25
Nodes (5): RegisterBeneficiaryInput, registerBeneficiarySchema, DisburseInput, disburseSchema, zod

### Community 31 - "export/route.ts"
Cohesion: 0.35
Nodes (9): GET(), DashboardData, data, csvField(), exportFileName(), HEADER, ledgerToCsv(), ledgerToJson() (+1 more)

### Community 32 - "Surface brief: VERA public surfaces and shared foundation"
Cohesion: 0.50
Nodes (3): Direction contract, Surface brief: VERA public surfaces and shared foundation, Unresolved decisions

### Community 33 - "dashboard/campaigns/[id]/page.tsx"
Cohesion: 0.24
Nodes (9): CHAIN_COPY, dynamic, ActionButton(), CardMode, KIND_LABEL, MilestoneCard(), STATUS_TONE, PublishCampaignButton() (+1 more)

### Community 34 - "activity.ts"
Cohesion: 0.11
Nodes (32): ActivityPage(), BADGE, dynamic, href(), metadata, shortHash(), SUMMARY, get() (+24 more)

### Community 35 - "AuthForm.tsx"
Cohesion: 0.18
Nodes (6): metadata, metadata, AuthForm(), COPY, FieldErrors, Mode

### Community 36 - "LedgerDashboard.tsx"
Cohesion: 0.24
Nodes (11): LedgerDashboard(), milestoneProgress(), Payouts(), ReconciliationBadge(), SEAL, useLiveData(), formatBps(), formatUtc() (+3 more)

### Community 39 - "store.ts"
Cohesion: 0.18
Nodes (11): indexerCursors, getCursor(), insertEvents(), setCursor(), Fetch, message(), syncOnce(), syncStream() (+3 more)

### Community 40 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, drizzle-kit, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/better-sqlite3, @types/node (+4 more)

### Community 41 - "Disbursement contract"
Cohesion: 0.23
Nodes (12): admin:promote CLI script, PayoutForm.tsx (record payout UI), VERA web app (Next.js full-stack), Beneficiaries feature (Step 13), BeneficiaryRegistry contract, Disbursement contract, Disbursement feature (Step 14), Disbursement downstream-of-manager divergence (SPDD 18.4) (+4 more)

### Community 42 - "Mining POL on Polygon Amoy — Step-by-Step Guide"
Cohesion: 0.17
Nodes (12): 0. Main wallet details (the destination), 1.1 Network settings (RPC URL, chain ID, etc.), 1.2 Set the RPC for your terminal session, 1.3 The project's own RPC setting (for contract work), 1.4 (Optional) Add Amoy to MetaMask, 1.5 Make a safe folder for temp-wallet keys, 1. One-time setup, 3. Optional: log your running total (+4 more)

### Community 43 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck (+3 more)

### Community 46 - "FakeChain"
Cohesion: 0.13
Nodes (10): retry(), FakeChain, 2026-09-19 — Faucet mining guide, 2026-09-19 - RPC fallback for the web app, 2026-09-19 - Step 10: Donation flow / simulated on-ramp (FR-CMP-02), 2026-09-19 - Step 5: Donor Registration (FR-IDN-01), 2026-09-19 - Step 6: Mock Organizer KYB (FR-IDN-02), 2026-09-19 - Step 8: Indexing core events (+2 more)

### Community 47 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, bcryptjs, better-sqlite3, drizzle-orm, jose, next, react, react-dom (+3 more)

### Community 48 - "VERA MVP — Progress Log"
Cohesion: 0.18
Nodes (11): Blocking real (non-demo) use, Cost and operations, Current status, Deployed on Polygon Amoy (chain 80002), Environment and gotchas, Next step, Open items, Product decisions to revisit (+3 more)

### Community 49 - "types/package.json"
Cohesion: 0.18
Nodes (10): devDependencies, typescript, typescript, main, name, private, scripts, typecheck (+2 more)

### Community 52 - "formatMinorUnits"
Cohesion: 0.23
Nodes (11): CampaignsIndexPage(), dynamic, metadata, CampaignsPage(), metadata, dynamic, OrganizerPublicPage(), CATEGORY_LABEL (+3 more)

### Community 55 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, admin:promote, build, db:generate, dev, lint, start, test (+1 more)

### Community 56 - "promote-admin.mjs"
Cohesion: 0.20
Nodes (8): args, db, dbFile, demote, email, emailHash, user, better-sqlite3

### Community 57 - "disbursement.test.ts"
Cohesion: 0.10
Nodes (25): cookieFor(), released(), shared, secondCampaign(), createCampaign(), recordVaultDeploy(), createPayoutReference(), hashPayoutReference() (+17 more)

### Community 58 - "VERA vision: milestone-gated escrow crowdfunding"
Cohesion: 0.29
Nodes (7): The 'Black Box' problem in legacy charity, Assam Monsoon Emergency Relief 2026 (case scenario), Governance Council Oversight (K-of-L), Milestone-Gated Smart Escrow mechanism, Independent Multi-Attestor Verification (M-of-N), Hard-Coded Overhead Ceilings, VERA vision: milestone-gated escrow crowdfunding

### Community 59 - "Module 2.1 Campaign Creation"
Cohesion: 0.25
Nodes (8): Fund figures written only by indexer, never by app, Three-layer defense-in-depth validation (UI, backend, contract), Module 1.3 Donor Identity & Onboarding, Module 1.4 Organizer Verification (Mock KYB), Module 2.1 Campaign Creation, Module 2.2 On-Chain Event Reading / Indexing, Module 2.3 Public Audit Dashboard, Module 3.1 Donation Flow (Simulated Funding)

### Community 60 - "contracts/package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, build, test, version

### Community 61 - "2. Daily loop (repeat each day)"
Cohesion: 0.29
Nodes (7): 2. Daily loop (repeat each day), Step 1 — Create a temp wallet, Step 2 — Claim POL from the faucet, Step 3 — Check the temp wallet balance, Step 4 — Sweep the temp wallet into the main wallet, Step 5 — Check the main wallet balance, Step 6 — Clean up

### Community 63 - "roles.ts"
Cohesion: 0.10
Nodes (22): DashboardIndex(), dynamic, apps_web_app_globals, besley, geistMono, hanken, metadata, LogoutButton() (+14 more)

### Community 65 - "Module 3.2 Milestone State Machine & Multi-Confirmation"
Cohesion: 0.40
Nodes (5): Hard-coded admin-expense cap ceiling, M-of-N unique confirmations per milestone, Module 3.2 Milestone State Machine & Multi-Confirmation, Module 3.3 Attestation (Verification) Flow, Module 3.4 Multi-Party Council Approval

### Community 66 - "PayoutForm.tsx"
Cohesion: 0.26
Nodes (10): CampaignForm(), onSubmit(), payload(), PayoutBeneficiary, PayoutForm(), submit(), short(), rupeesToMinorUnits() (+2 more)

### Community 67 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 68 - "Organizer KYB flow"
Cohesion: 0.83
Nodes (4): Organizer KYB flow, Uploaded documents (KYB/evidence), Document-storage design reversal (hash-only to uploaded file), Uploaded Documents (KYB / Milestone Evidence)

### Community 69 - "VERA main/deployer/sponsor wallet"
Cohesion: 0.25
Nodes (8): Donation flow (Step 10), Sponsor wallet (gas sponsorship), Daily faucet-mine-and-sweep loop, Gas price check before deployment, VERA main/deployer/sponsor wallet, 570 gwei gas spike incident (MilestoneManager deploy), Gas Sponsorship Engine (sponsor.ts), Client-Side Custodial Wallet Security (AES-256-GCM)

### Community 70 - "Layered Architecture L0-L3"
Cohesion: 0.50
Nodes (4): Defense-in-Depth Layers (client, API, DB, contract), Error-Flow Philosophy (funds stay locked on failure), Layered Architecture L0-L3, Public Testnet Ledger (Polygon Amoy / Sepolia)

### Community 71 - "VERA MVP Functional Roadmap"
Cohesion: 0.67
Nodes (3): VERA MVP Functional Roadmap, Module 1.1 Project Foundation & Shared Vocabulary, Module 1.2 Core On-Chain Escrow Skeleton

## Ambiguous Edges - Review These
- `graphify knowledge graph` → `Git no-commit rule`  [AMBIGUOUS]
  CLAUDE.md · relation: conceptually_related_to

## Knowledge Gaps
- **439 isolated node(s):** `metadata`, `metadata`, `dynamic`, `metadata`, `BADGE` (+434 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 541 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `graphify knowledge graph` and `Git no-commit rule`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `VERA web app (Next.js full-stack)` connect `Disbursement contract` to `getDb`, `MilestoneManager contract`, `Organizer KYB flow`, `PROGRESS_LOG`?**
  _High betweenness centrality (0.184) - this node is a cross-community bridge._
- **Why does `getDb()` connect `getDb` to `activity.ts`, `files/service.ts`, `dashboard.ts`, `runtime.ts`, `beneficiary/service.ts`, `organizers/service.ts`, `activity.test.ts`, `getEnv`, `next`, `formatMinorUnits`, `disbursement.test.ts`, `session.ts`, `indexer.integration.test.ts`, `users.ts`, `export/route.ts`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `VERA MVP SPDD` connect `PROGRESS_LOG` to `CampaignVault.sol (escrow)`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `metadata`, `metadata`, `dynamic` to the rest of the system?**
  _439 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `escrow/service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `donations/service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07315233785822021 - nodes in this community are weakly interconnected._