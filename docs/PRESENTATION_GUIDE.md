# VERA: presentation study guide

A walk through the whole project in the order you would present it: setup, local blockchain, contracts, deployment on Polygon Amoy, then the website. Every claim here was checked against the code in the repo.

Scope note: the Solidity contracts (about 700 lines) are explained nearly line by line, because they are the heart of the project. The web app has about 400 files, so the core files are explained in detail and the rest are explained per file or per folder.

---

## 0. The 60-second pitch

**Problem:** in disaster relief and charity crowdfunding, donors cannot see where money goes, and organizers can take it and disappear.

**VERA:** donations go into a smart contract (an escrow vault). The organizer cannot touch the money. It is released in stages, only when independent attestors confirm each milestone is done, and large releases also need a council to approve. Beneficiaries are registered as anonymous fingerprints so nobody is paid twice. Every rupee is visible on a public ledger which is continuously checked against the blockchain.

**Key sentences to remember:**
1. "The organizer has no function that can withdraw funds. Only the MilestoneManager contract can release, and only after attestation."
2. "The website never invents a money figure. Totals come from blockchain events, and a reconciler proves they match the chain exactly."
3. "It runs on Polygon Amoy testnet with a fake rupee token, so nothing here has real value."

**Cast of roles:** Donor, Organizer (verified via mock KYB), Attestor, Council member, Admin.

---

## 1. Repository map (top level)

| Path | What it is |
|---|---|
| `package.json` | Root of the pnpm workspace. Scripts: `pnpm dev` (run website), `pnpm build`, `pnpm lint`, `pnpm test` (forge, contract tests), `pnpm test:web` (vitest, website tests). `devEngines` pins pnpm 11. |
| `pnpm-workspace.yaml` | Declares the workspace packages (`apps/*`, `contracts`, `packages/*`, `indexer`) and `allowBuilds`: native packages allowed to run install scripts (`better-sqlite3` for the database, `esbuild`, `sharp`, `unrs-resolver`). |
| `pnpm-lock.yaml` | Exact dependency versions. |
| `.env.example` | Template listing every environment variable with comments. Real `.env` files are git-ignored so keys never get committed. |
| `.gitignore`, `.graphifyignore` | Ignore rules. `.graphifyignore` keeps the knowledge-graph tool away from vendored libs and wallet files. |
| `README.md` | GitHub front page: what VERA is, quick start, layout. |
| `contracts/` | The Solidity smart contracts (Foundry project). |
| `apps/web/` | The website and its backend (Next.js). |
| `packages/types/` | `@vera/types`: shared TypeScript types (campaign, milestone, donation, beneficiary) mirroring the design document. Source-only, no build step. Deliberately has no money figures. |
| `indexer/` | An empty leftover folder. The indexer was built inside the web app instead. |
| `docs/` | Design docs and logs (see section 11). |
| `graphify-out/` | An auto-generated knowledge graph of the codebase (tooling, not part of the product). |
| `media/`, `media2/` | Screenshots of the live Amoy walkthrough (landing page, signup, admin approval, Polygonscan transactions, donation, attestation, release, payouts). Useful as demo backup. |
| `mock documents/` | Sample files to upload as KYB documents and milestone evidence during a demo. |

---

## 2. Initial setup

### 2.1 Tools
- **Node 20+** and **pnpm**: JavaScript runtime and package manager.
- **Foundry**: Solidity toolkit with three programs: `forge` (compile and test), `anvil` (local blockchain), `cast` (command-line chain inspector).
- **Git Bash** on Windows (docs use Unix syntax).

### 2.2 Install
`pnpm install` at the repo root installs the website's dependencies. This is possible because of the workspace file above. The `contracts/lib/` folder (forge-std and OpenZeppelin) is committed as plain files, not git submodules, so a fresh clone works immediately.

### 2.3 Why a pnpm workspace?
One repo, three packages (`web`, `contracts`, `@vera/types`). The website imports `@vera/types` via `"@vera/types": "workspace:*"` in `apps/web/package.json`.

### 2.4 Environment variables (`.env.example`, validated by `apps/web/lib/env.ts`)
Group them like this when explaining:

| Group | Variables | Meaning |
|---|---|---|
| Chain | `RPC_URL`, `MOCK_INR_ADDRESS` | Where to talk to the blockchain; the token contract. `RPC_URL` can be a comma-separated list used as ordered fallbacks, since free public RPCs go down. |
| App secrets | `AUTH_SECRET` (32+ chars), `WALLET_ENCRYPTION_KEY` (64 hex = 32 bytes), `DATABASE_URL` | Sign login cookies; encrypt users' wallet keys; SQLite file path. |
| Platform wallet | `FACTORY_OWNER_KEY` | Private key of the wallet that owns the Factory and also pays gas for users ("sponsor"). Testnet key only. |
| Contract addresses | `FACTORY_ADDRESS`, `MILESTONE_MANAGER_ADDRESS`, `BENEFICIARY_REGISTRY_ADDRESS`, `DISBURSEMENT_ADDRESS` | Each one **switches a feature on**. No address means the feature says "not configured". |
| Start blocks | `INDEXER_START_BLOCK`, `MANAGER_START_BLOCK`, `REGISTRY_START_BLOCK`, `DISBURSEMENT_START_BLOCK` | The block each contract was deployed in. The indexer starts reading there instead of scanning from genesis. |
| Indexer tuning | `INDEXER_CONFIRMATIONS` (2), `INDEXER_MAX_RANGE` (2000) | Only trust blocks 2 deep; block range per log query. |
| Fee | `PLATFORM_FEE_MINOR_UNITS`, `PLATFORM_FEE_ADDRESS` | Optional flat donation fee, 0 by default. |

---

## 3. The smart contracts (`contracts/`)

### 3.1 Folder layout

| Path | Purpose |
|---|---|
| `foundry.toml` | Foundry config. `src="src"`, `out="out"`, `libs=["lib"]`. `[fuzz] runs = 10000`: every fuzz test runs 10,000 random inputs. |
| `remappings.txt` | Maps import names like `@openzeppelin/contracts/` to `lib/openzeppelin-contracts/contracts/`. |
| `package.json` | Lets pnpm run `forge test` through the workspace. |
| `src/` | The 6 contracts (below). |
| `script/Deploy.s.sol` | A deploy script (deploys MockINR and CampaignFactory). |
| `test/` | 7 test files, 94 tests in all. |
| `lib/` | Vendored dependencies: `forge-std` (test helpers) and OpenZeppelin v5. |
| `out/`, `cache/` | Build output (generated). |
| `broadcast/` | Records of real deployments made by `forge script`. |
| `FETCH_HEAD` | Stray git file; ignore. |

### 3.2 How the six contracts fit together

```
MockINR (token) ──holds funds──> CampaignVault (one per campaign)
                                      ▲  releaseForMilestone()  (ONLY caller allowed)
CampaignFactory ──deploys──> vault    │
(checks organizer, caps, 100%)   MilestoneManager (shared)
                                      │ pays organizer
                                      ▼
BeneficiaryRegistry ──checked by──> Disbursement (records payout to a beneficiary)
```

Flow of money: Donor -> **vault**. Vault -> (via **manager**, after attestations/council) -> **organizer**. Organizer -> (via **Disbursement**, to a registered beneficiary) -> recorded payout.

### 3.3 `MockINR.sol` (34 lines): the fake rupee

- `contract MockINR is ERC20` : inherits OpenZeppelin's standard token (transfer, approve, balanceOf, ...).
- `constructor() ERC20("Mock Indian Rupee", "mINR") {}` : sets the name and symbol.
- `uint8 private constant DECIMALS = 6;` : a token stores whole numbers only; 6 decimals means 1 mINR = 1,000,000 "minor units". Same convention as USDC.
- `function mint(address to, uint256 amount) external { _mint(to, amount); }` : **anyone can mint any amount**. That is a faucet, intentional for a testnet. The comment warns never to do this on mainnet.
- `function decimals() public pure override returns (uint8)` : overrides the default 18 with 6.

**Likely question: why 6 decimals not 2 (paise)?** Headroom for percentage math without rounding error.

### 3.4 `CampaignFactory.sol` (170 lines): the gatekeeper

- `contract CampaignFactory is Ownable` : has an owner (the platform wallet). OpenZeppelin v5 requires an explicit owner, hence `Ownable(msg.sender)` in the constructor.
- `enum CampaignCategory { DISASTER_RELIEF, MEDICAL, COMMUNITY }` : must stay in sync with the TypeScript type.
- `struct MilestoneInput { uint256 targetPct; }` : just the percentage of funds each milestone gets.
- `mapping(CampaignCategory => uint256) public categoryAdminCeilingPct` : max admin-cost percent per category.
- `mapping(address => bool) public isVerifiedOrganizer` : the on-chain list of approved organizers.
- `MIN_INACTIVITY_WINDOW = 1 hours`, `MAX_DEADLINE = 3 * 365 days` : bounds for expiry settings.
- `address public immutable mockToken` : the token every vault uses; `immutable` means set once in the constructor, never changeable.
- `address public milestoneManager` : the manager new vaults bind to (owner can set it, but each vault copies it forever).
- `struct CampaignRecord` + `CampaignRecord[] private _campaigns` + `_campaignIndexesByOrganizer` : an on-chain list of campaigns and an index by organizer.
- Events: `OrganizerVerifiedSet`, `MilestoneManagerSet`, `CampaignCreated(campaignId, organizer, vault, category, fundingGoal)`. **`CampaignCreated` is how the website discovers vaults.**
- Custom errors (`OrganizerNotVerified`, `AdminCapExceeded`, `MilestonesDoNotSumTo100`, ...) : cheaper than string reverts and carry data.
- `constructor(address _mockToken)` : stores the token and sets ceilings **10% / 15% / 20%**.
- `setOrganizerVerified(organizer, verified)` : `onlyOwner`. Called by the website after the admin approves KYB, so the database status and the on-chain status are the same action.
- `setMilestoneManager(manager)` : `onlyOwner`, rejects zero address.
- `setCategoryAdminCeiling(...)` : `onlyOwner`.
- **`createCampaign(category, fundingGoal, milestones, adminCapPct, deadline, inactivityWindow)`**, the key function, step by step:
  1. Revert if no manager is configured.
  2. Revert if `msg.sender` is not a verified organizer. (So the organizer's **own wallet** must send this transaction.)
  3. Revert if `adminCapPct` is above the category ceiling.
  4. Revert if there are zero milestones.
  5. Loop adding up `targetPct`; revert unless the sum is **exactly 100**.
  6. Revert if the deadline is not in the future or is over 3 years away; revert if the inactivity window is under 1 hour or over 3 years.
  7. `new CampaignVault(...)` deploys a fresh vault, bound to the organizer, manager and schedule.
  8. Save a `CampaignRecord`, index it by organizer, emit `CampaignCreated`.
- `getCampaignsByOrganizer`, `getCampaign`, `campaignCount` : read-only views.

**Point to stress:** these rules live in the contract, so even a hacked website or a direct call cannot bypass them. The website also checks them for fast feedback, but the contract is the authority ("defence in depth").

### 3.5 `CampaignVault.sol` (225 lines): the escrow

State:
- `token`, `organizer`, `milestoneManager` : all `immutable`. **There is no setter for the manager**, so nobody can ever give themselves release rights.
- `_balance` : the vault's own accounting of what it holds. Always reconcilable against the token's `balanceOf(vault)`.
- `paused` : an optional freeze flag.
- `deadline`, `inactivityWindow`, `createdAt`, `lastProgressAt` : the expiry schedule. `lastProgressAt` moves on each milestone *release* (donations do not reset it).
- `enum CloseReason { Deadline, Inactivity, Completed }`
- `closed`, `refundPool`, `totalDonated`, `donatedBy[donor]`, `refundClaimed[donor]` : refund accounting.

Functions:
- `constructor(...)` : reverts on a zero manager, a deadline in the past, or a zero window; records the creation time.
- **`deposit(amount)`** : `nonReentrant whenNotPaused`. Reverts on zero, if closed, or if past the deadline. **Updates its own books first** (`_balance`, `totalDonated`, `donatedBy`), **then** pulls the tokens with `safeTransferFrom`, then emits `DonationReceived(donor, amount, newBalance)`. Books-before-transfer is the "checks-effects-interactions" pattern that defeats reentrancy attacks. The donor must have `approve`d the vault first (that is the "approve" step in the donation flow).
- `getBalance()` : returns `_balance`.
- **`releaseForMilestone(to, amount)`** : `onlyMilestoneManager`. The only way money leaves in normal operation. Reverts if closed or if `amount > _balance`; subtracts, updates `lastProgressAt`, transfers tokens. **It emits no event**, which is why `MilestoneManager` emits `MilestoneReleased` instead.
- `closableReason()` : view. Returns `(can, reason)`. Not closable if already closed or empty. Closable as **Completed** if the manager says 100% released; **Deadline** if time is past the deadline; **Inactivity** if time is past `lastProgressAt + inactivityWindow`.
- `close()` : **anyone** can call it when closable. Sets `closed = true` and freezes the current balance as `refundPool`. Works even while paused, so a pause can never trap donors.
- `refundOf(donor)` : `refundPool * donatedBy[donor] / totalDonated` (pro-rata share), 0 if already claimed or not closed.
- `claimRefund()` : the donor pulls their share, once. Sets `refundClaimed` and reduces `_balance` before transferring.
- `_allReleased()` : asks the manager (`releasedPct(vault) == 100`); guarded by `code.length == 0` so it does not crash if the manager is not a contract.
- `pause(reason)` / `unpause()` : organizer only; blocks `deposit` and `releaseForMilestone` but never `close` or `claimRefund`. Honestly labeled a demo feature, not production compliance.

**Refund example:** Alice gave 300, Bob gave 100 (total 400). Campaign closes with 200 left. Alice gets 200*300/400 = 150, Bob gets 50. Money already released to the organizer is never clawed back.

### 3.6 `MilestoneManager.sol` (265 lines): governance

One shared manager for **every** vault.

Constants and state:
- `MIN_REQUIRED_ATTESTATIONS = 2` : no single attestor can verify a milestone alone. `MIN_COUNCIL_THRESHOLD = 2`.
- `enum Status { Pending, Verified, Released }`
- `struct Milestone { targetPct, requiredAttestations, autoReleaseLimit, attestationCount, councilApprovals, status }` : `autoReleaseLimit` is **snapshotted** at definition time so changing the global limit later cannot skip or add a council step to an existing milestone.
- `isAttestor`, `isCouncilMember` : global role lists curated by the owner.
- `councilThreshold` (3 in the deployment), `autoReleaseLimit` (100 mINR in the deployment).
- Per-vault: `_milestones[vault]`, `definedPct`, `releasedPct`, `releasedTotal`.
- `hasAttested[vault][index][attestor]`, `hasApproved[vault][index][member]` : stop double counting.

Functions:
- `constructor(limit, threshold)` : threshold must be at least 2.
- `setAttestor`, `setCouncilMember`, `setCouncilThreshold`, `setAutoReleaseLimit` : `onlyOwner`. **The owner can curate the lists but can never release funds or approve for anyone.**
- **`defineMilestone(vault, targetPct, requiredAttestations)`** : callable only by that vault's organizer; the vault must be bound to this manager; pct 1-100; attestations at least 2; running total of defined percentages cannot exceed 100. Appends the milestone as Pending.
- **`submitAttestation(vault, index, proofHash)`** : caller must be an attestor, **cannot be the vault's organizer**, milestone must not be released, and each attestor counts once. Increments the count and emits `MilestoneAttested(... proofHash)`. When the count reaches the requirement the status becomes **Verified** and `MilestoneVerified` is emitted. `proofHash` is the SHA-256 fingerprint of the evidence file.
- **`councilApprove(vault, index)`** : council members only, milestone must be Verified, once per member.
- `releasableAmount(vault, index)` : the math. `raised = vault.getBalance() + releasedTotal`; `entitled = raised * (releasedPct + milestone.targetPct) / 100`; payable = `entitled - releasedTotal`. In words: this milestone's cumulative share of everything ever raised, minus what was already paid. If donations arrive later, later milestones automatically include them.
- **`release(vault, index)`** : `nonReentrant`, **permissionless** (anyone can trigger it once the rules are met). Checks, in order: not already released; is Verified; milestones are fully defined (total exactly 100); released **in order**; amount is non-zero; if `amount > autoReleaseLimit` then `councilApprovals >= councilThreshold`. Then updates state *first*, and calls `vault.releaseForMilestone(organizer, amount)`; the recipient is always the vault's organizer, nobody can choose another. Emits `MilestoneReleased`, **the only record of a release**.
- `milestoneCount`, `getMilestone`, internal `_get`, `_pctBefore`, `_nextIndex` : helpers.

**Worked example (illustrative, computed from the formula):** 250 mINR donated, milestones 50% / 50%, auto-release limit 100 mINR. Milestone 1 pays 250 x 50 / 100 = 125, which is over the limit, so it needs 3 council approvals as well as the attestations. Milestone 2 pays 250 x 100 / 100 - 125 = 125, also over the limit. With a limit of 150 instead, both would release on attestations alone. For what actually happened in the live run (which milestone needed the council), check the screenshots 18-22 in `media/` and `docs/PROGRESS_LOG.md` before stating it.

### 3.7 `BeneficiaryRegistry.sol` (49 lines): anti-fraud without personal data

- `isRegistered[vault][identityHash]` and `beneficiaryCount[vault]`.
- `register(vault, identityHash, photoHash)` : only the vault's organizer can call; the hash cannot be zero; a repeat reverts with `DuplicateBeneficiary`. Emits `BeneficiaryRegistered`.
- **No owner, no admin function, no plaintext anywhere in the ABI.** The identity hash is made in the organizer's browser (section 8.8), so the platform and the blockchain never see who the person is. The same person can still register in a different campaign.

### 3.8 `Disbursement.sol` (130 lines): recording payouts

- Reads the token, manager and registry (all immutable).
- `payableRemaining(vault)` = `manager.releasedTotal(vault) - disbursedTotal[vault]`.
- `disburse(vault, milestoneIndex, identityHash, amount, payoutRef)` : caller must be the vault's organizer; the vault must be bound to the real manager; amount non-zero; payout reference non-zero; **that milestone not already paid**; milestone status must be Released; the beneficiary must be registered; amount must not exceed what was released and not yet paid out. Then it marks the milestone paid, increases `disbursedTotal`, and pulls the tokens from the organizer (who must have `approve`d it first). Emits `PayoutRecorded`.
- **Honest divergence to mention if asked:** the original design had the vault pay Disbursement directly. The manager was already deployed and immutable and pays the organizer, so Disbursement sits downstream: the organizer receives funds, then hands them over. It can guarantee a payout is recorded only for real released milestones, but it cannot force the organizer to hand the money over. The real bank transfer is simulated (a mock "off-ramp" reference whose hash goes on-chain).

### 3.8b `BeneficiaryRegistryV2.sol` and `DisbursementV2.sol`: the chain checks that beneficiaries exist (added 2026-11-06)

- **Why:** the first registry proves a beneficiary is **unique**, not that they **exist**. An organizer could register people who do not exist and record payouts to them. The app-level fix (an attestor must confirm each beneficiary) can be bypassed by anyone calling the contract directly.
- `BeneficiaryRegistryV2(manager, requiredAttestations)`: `register` is exactly as before; `attestBeneficiary(vault, identityHash)` is callable only by an attestor registered on the existing manager, never the vault's own organizer, only for a registered beneficiary, once per attestor. `isVerified` becomes true at the required number (at least 1). Event `BeneficiaryAttested`.
- `DisbursementV2`: identical to `Disbursement`, but it checks `registry.isVerified` and reverts `BeneficiaryNotVerified`.
- **Deployed on Amoy 2026-11-06:** registry `0xF1C72cF2D5722a837305424D1966BBBe7F73454a` (block 52128113), disbursement `0xba49F68CabB0389091B4767aedfFc90B182f7Bd2` (block 52128142). One real registration, on-chain attestation and payout was run through them on Amoy. **The running website is not switched over** (`.env.local` still uses the original two); the app supports them behind `BENEFICIARY_REGISTRY_V2=1`.
- 28 tests including four fuzz tests at 10,000 runs; Slither found no medium or high issue.
- **Not done, on purpose (C7):** per-campaign release limits and council thresholds need a new manager, Factory and Disbursement and a migration; it is rated 9/10 risk and is on hold.

### 3.9 Tests (`contracts/test/`)
`MockINR.t.sol`, `CampaignFactory.t.sol`, `CampaignVault.t.sol`, `CampaignVaultRefund.t.sol`, `MilestoneManager.t.sol`, `BeneficiaryRegistry.t.sol`, `Disbursement.t.sol`, `BeneficiaryRegistryV2.t.sol`, `DisbursementV2.t.sol` (122 tests in all). Written in Solidity with forge-std. Each checks the happy path and every revert (non-organizer, wrong sums, double attestation, out-of-order release, ...). Fuzz tests feed 10,000 random values into fund-moving functions. Result: **94 of 94 pass**. Slither (static analyzer): 8 informational/low findings, 0 medium/high.

### 3.10 `script/Deploy.s.sol`
- `vm.envUint("DEPLOYER_PRIVATE_KEY")` reads the key from the environment.
- `vm.startBroadcast(key)` ... `vm.stopBroadcast()` : transactions between these two lines are really sent.
- Deploys `MockINR`, then `CampaignFactory(address(mockINR))`; optionally calls `setMilestoneManager` if `MILESTONE_MANAGER` is set; prints both addresses.
- Be honest: this script alone deployed only the token on Amoy; the other contracts were deployed with `forge create` (see section 5).

---

## 4. The local blockchain (zero cost): `docs/manual_test_local.md`

**Why:** Amoy testnet POL (gas currency) is scarce and slow to collect. A local chain gives free, instant, repeatable testing.

**Tool: `anvil`**, a blockchain on your own machine.
```
anvil --chain-id 80002 --block-time 1
```
- `--chain-id 80002` pretends to be Amoy, so the app needs no code changes.
- `--block-time 1` mines a block every second. Important because the indexer only trusts blocks 2 deep; without new blocks data would look stale.
- It prints 10 test accounts with publicly known keys and fake money. Account 0 becomes the platform "sponsor". Everything is in memory: closing anvil erases the chain.

**Deploy order matters** (later contracts need earlier addresses), using `forge create ... --broadcast`:
1. MockINR
2. MilestoneManager with `--constructor-args 100000000 3` (auto-release limit = 100 mINR in minor units, council needs 3)
3. CampaignFactory with the token address
4. BeneficiaryRegistry
5. Disbursement with token, manager, registry

(`--constructor-args` must be last on the line because it accepts any number of values.) On a fresh anvil the addresses are deterministic. Then `cast send <factory> "setMilestoneManager(address)" <manager>` wires the factory to the manager **before any campaign exists**, because each vault copies the manager at creation.

**Pointing the site at it:** create `apps/web/.env.development.local` with `RPC_URL=http://127.0.0.1:8545`, the five addresses, start blocks of 0, and `FACTORY_OWNER_KEY` set to anvil's account 0 key. This file overrides `.env.local` during `pnpm dev`.
**Danger noted in the docs:** if you forget to delete that file, the app silently keeps using the dead local chain. This caused a real incident.

**Free automated proofs:** `lib/disbursement/live-local.test.ts` and `lib/expiry/live-local.test.ts` (run with `LIVE_LOCAL=1`) execute real chain flows against anvil; the expiry test fast-forwards the chain clock with `evm_increaseTime` to test deadlines without waiting.

**Other Foundry tools:** `cast gas-price` checks gas before spending; `cast call` / `cast balance` read chain state for free.

---

## 5. Deployment on Polygon Amoy: `docs/mining_instructions.md`, `docs/manual_test_live.md`

- **Network:** Polygon Amoy testnet, chain ID 80002, currency POL (gas), explorer `amoy.polygonscan.com`.
- **Getting POL:** from the Polygon faucet via throwaway wallets, swept into the main wallet (`mining_instructions.md`). The main wallet is the deployer, Factory owner, **and** the app's gas sponsor.
- **RPC endpoints:** the official one was unreachable from the dev machine; dRPC, PublicNode and Tenderly work. The app takes a comma-separated list and falls back in order.
- **Before deploying:** `cast gas-price`, and always cap with `--gas-price`. Amoy once spiked to 570 gwei and a manager deploy cost 1.41 POL.

**Deployed addresses**

| Contract | Address | Block |
|---|---|---|
| MockINR | `0x9b6f00a1ce627a3e0d2da601253704084d8fc52c` | 47969900 |
| MilestoneManager | `0xe6d7222dDe3eE4b9688269427631aDF49229e747` | 47997230 |
| BeneficiaryRegistry | `0xA4BF48D348246f66281B8Ca191F3981e15E5C54D` | 48161539 |
| Disbursement | `0x8305ECfbd9365efF27efD6f360C36589C006e5eA` | 48925371 |
| CampaignFactory (current) | `0xcBA47322e213107C19Be706e6817629744A42364` | 51136547 |

Why a new Factory? Adding expiry/refunds changed the vault's constructor, and vaults cannot be upgraded. The old Factory `0x6931...0bD` was retired; the app follows one Factory only.

**Real on-chain milestones to cite:** attestation, council approval and release verified live on 2026-09-30; a real 30 mINR payout recorded through Disbursement (tx `0xeeaf44ac...c0211b4`, block 48939598); full walkthrough on the new Factory on 2026-10-26. The one thing not exercised on real Amoy is close/refund, because it needs a deadline to pass (it is proven on the local chain).

**Honest gotchas:** campaigns #0-#3 on the first Factory used a placeholder manager and are demo-only. Gas-price protection: the sponsor refuses to send above 150 gwei.

**Cost discipline:** live test `live-amoy.test.ts` costs about 0.3 POL a run and is opt-in (`LIVE_AMOY=1`); everything else is tested free first.

---

## 6. The website, big picture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4. One app is both frontend and backend: the API lives in `app/api/v1/**/route.ts`. Database: SQLite via `better-sqlite3` and Drizzle ORM. Blockchain access: `viem`. Validation: `zod`. Login: `jose` (JWT) + `bcryptjs`. Tests: `vitest`.

**Request lifecycle** (this is the architecture slide):
```
browser -> route.ts (thin) -> requireUser (role from DB) -> rate limit -> zod validation
        -> lib/<area>/service.ts (business logic) -> SQLite (Drizzle) and/or viem -> Amoy
```

**Six conventions to quote**
1. **Thin routes, fat services.** Route files parse and authorize, services decide.
2. **Role read from the DB on every request**, not from the login token, so promotions take effect immediately.
3. **One error envelope** `{ error: { code, message, details } }` with specific codes, never a bare 500.
4. **Money is never a float** and **never stored**. Integer minor units as strings/BigInt; totals derived from chain events.
5. **Every chain operation is wrapped so it never throws**; the database record is saved first so a chain failure never loses it, and the result is retryable.
6. **Ports and fakes**: each chain feature has a `chain-port.ts` interface, a real implementation (`lib/chain/*`) and a `fake-chain.ts` used in tests, so ~400 tests run with no blockchain.

---

## 7. `apps/web` root files

| File | What it does |
|---|---|
| `package.json` | Scripts: `dev`, `build`, `start`, `lint`, `test` (vitest), `typecheck`, `db:generate` (create a migration), `admin:promote`. Dependencies as above. |
| `next.config.ts` | Empty default Next config. |
| `tsconfig.json` | TypeScript settings; the `@/` alias maps to the app root. |
| `vitest.config.mts` | Test runner: Node environment, `**/*.test.ts`, with the `@` alias. |
| `drizzle.config.ts` | Drizzle Kit: SQLite dialect, schema at `lib/db/schema.ts`, output to `drizzle/`. |
| `eslint.config.mjs`, `postcss.config.mjs` | Lint and Tailwind/PostCSS config. |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Package manager files. |
| `scripts/promote-admin.mjs` | The **only** way to create an admin (`pnpm --filter ./apps/web admin:promote <email>`). There is deliberately no web route that grants admin. |
| `PRODUCT.md`, `DESIGN.md`, `.impeccable/` | Product principles and the visual design system (dark charcoal theme, copper accent, fonts Besley/Hanken Grotesk/Geist Mono), plus design-tool critiques. |
| `public/` | Default Next SVG assets. |
| `data/` | Runtime SQLite databases (git-ignored); `vera.db` holds the live walkthrough. |

---

## 8. `apps/web/lib/`: the logic, domain by domain

### 8.1 `env.ts`
Defines a `zod` schema for all environment variables (section 2.4). Key behaviours:
- `address()` helper uses viem's `isAddress`, which checks the EIP-55 capitalization checksum, so a typo fails at startup instead of mid-transaction.
- `optionalInt` treats a blank value as "unset" (not zero).
- `superRefine` enforces "a fee requires a fee address".
- `getEnv()` validates **lazily** on first use and caches, so `next build` and tests do not need every variable. `resetEnvCache()` is a test hook.

### 8.2 `db/`
- `schema.ts` defines all 13 tables. In plain words:
  - `users` (email + hashed email, bcrypt password hash, wallet address, `walletKeyEnc` encrypted private key, role)
  - `organizer_profiles` (KYB application: legal name, registration number, document hash, status pending/verified/rejected, and the result of syncing to the chain)
  - `campaigns` (metadata only, **no balances**; goal as a string; `vaultContractAddress`, `chainStatus`, expiry fields)
  - `milestones` (description, percent, required attestations, sequence)
  - `chain_events` (the append-only copy of blockchain events; id = `txHash:logIndex`; **the only source of money figures**)
  - `indexer_cursors` (how far each stream has been read)
  - `donations` (state machine record with a tx hash per step; `onchain_tx_hash` UNIQUE so a deposit cannot count twice; `locked_until` lock)
  - `role_grants` (who the admin made attestor/council)
  - `milestone_actions` (each attestation/approval/release request; unique per milestone+kind+actor)
  - `campaign_salts` (per-campaign random salt, in its own table so campaign rows can be returned wholesale without leaking it)
  - `beneficiaries` (identity hash only, unique per campaign)
  - `disbursements` (payout records, unique per milestone)
  - `documents` (uploaded file bytes + SHA-256)
- `index.ts`: `createDb` opens SQLite, turns on `WAL` journaling and `foreign_keys`, and **runs migrations automatically**. `getDb()` caches the connection on `globalThis` so Next's hot reload does not open many connections.
- `drizzle/0000...0011_*.sql`: twelve forward-only migrations, one per feature (users, organizers, campaigns, chain events, donations, escrow, beneficiaries, disbursements, documents, expiry, beneficiary attestations, their on-chain status). The `meta/` folder is Drizzle's snapshot bookkeeping.

### 8.3 `auth/`: accounts and login
- `crypto.ts`: `hashEmail` = SHA-256 of the trimmed, lower-cased email (duplicate-account check). `encryptSecret` = **AES-256-GCM**: random 12-byte IV, encrypt, take the authentication tag, store as `iv:tag:ciphertext` in hex. `decryptSecret` reverses it and fails if tampered.
- `password.ts`: bcrypt hashing; `DUMMY_HASH` lets login do the same work whether or not the email exists (no timing leak).
- `users.ts`: `registerDonor` hashes the email, checks for a duplicate, **generates a wallet** (or accepts an external address, which is stored unverified and cannot be signed for), encrypts the key, bcrypt-hashes the password, inserts. A UNIQUE-constraint failure is also mapped to "already registered". `toPublicUser` ensures password hash and wallet key never leave the server. `authenticate` verifies credentials.
- `session.ts`: `signSession` creates an HS256 JWT valid 24 h (subject = user id). `verifySession` returns null for a missing/tampered/expired token and never throws. Cookie `vera_session` is `HttpOnly; SameSite=Lax` (+`Secure` in production).
- `request-user.ts`: reads the cookie, verifies the token, then loads the **current** user from the DB.
- `validation.ts`: zod schemas for register/login (password at least 12 chars).

### 8.4 `api/`
- `errors.ts`: the `ErrorCode` list (about 45 specific codes) and `apiError(status, code, message, details?)`.
- `guards.ts`: `requireUser(request, ...roles)` returns 401 `UNAUTHENTICATED` if not signed in, 403 `FORBIDDEN` if the DB role is not allowed. `readJson` returns a 400 on bad JSON.
- `rate-limit.ts`: an in-memory **token bucket**: each key has a capacity that refills over time; each request spends one token. Example: donations allow 10 per minute per user.

### 8.5 `chain/`: talking to the blockchain (all via viem)
- `wallet.ts`: `generatePrivateKey()` and derive the address. A donor never needs to know crypto.
- **`sponsor.ts`**: new wallets have no POL, so the platform pays gas. `topUpGas(to, requiredWei)` reads the wallet balance and, if short, sends the difference from the sponsor wallet. `withSponsorLock` is a promise queue so two top-ups never race for the same **nonce**. `MAX_GAS_PRICE_WEI` = 150 gwei: above it, sponsored actions refuse with a plain message to protect the wallet. `transport()` builds a viem `fallback` over the RPC list.
- **`campaigns.ts`** `deployCampaignVault`: checks the organizer is verified **on-chain**, checks the chain's category ceiling, decrypts the organizer's key and confirms it matches their address, computes the deadline from the **chain's own clock** (`getBlock().timestamp`), estimates gas, refuses if gas is too expensive, uses `max(1.4 x estimate, 2.2M)` as the gas limit, tops up the organizer's gas, signs **as the organizer** (the Factory records `msg.sender`), waits for the receipt, and reads the new vault address out of the `CampaignCreated` event log. Returns `{status:"deployed"|"failed"|"not_configured"}`, never throws.
- `factory.ts`: mirrors organizer approval to `setOrganizerVerified`.
- `manager.ts`: attest / council / release / roles. It **simulates first** so a contract revert becomes a plain sentence.
- `donations.ts`: the donor-side steps `mint`, `approve`, `deposit`, the fee transfer, receipt checks and `verifyDeposit`.
- `registry.ts`: beneficiary registration. `disbursement.ts`: approve + `disburse`. `expiry.ts`: `close()` and `claimRefund()`. `balance.ts`: reads mINR/POL balances. `mockOffRamp.ts`: creates the fake payout reference.
- `reader.ts`: the indexer's reader. Declares each event's ABI, uses `getLogs` per contract/block range, and returns normalized `RawEvent`s. Also reads the vault's `getBalance()` and the token balance **at a specific block** for reconciliation.

### 8.6 `indexer/`: the trust engine
- `types.ts`: `ChainReader` and `RawEvent` interfaces.
- `store.ts`: `insertEvents` (idempotent insert keyed by `txHash:logIndex`), `getCursor`/`setCursor`, `knownVaults` (read from `CampaignCreated` events), `eventsForVault`.
- **`sync.ts`**: `syncOnce` gets the chain head, computes `safeBlock = head - confirmations (2)`, then syncs streams in order: `factory` first (to discover vaults), then `manager`, `registry`, `disbursement`, then each `vault:<address>`. `syncStream` reads in chunks starting from just after the cursor; if a chunk fails it **halves the size and retries** (providers refuse big ranges), doubles it back after success, and **advances the cursor only after events are stored**. It never throws; errors come back in a list and the next pass resumes.
- `runtime.ts`: `indexerRuntime()` builds the config or returns null (indexer **off** if the factory address or start block is missing, rather than guessing). `syncIfStale` runs a sync at most every 10 s and shares one in-flight pass between callers. `syncWithinBudget` makes a page wait at most 8 s, then show what is already indexed, so a page never hangs.
- **`queries.ts`**: `vaultTotals` sums donations, releases, payouts and refunds from stored events (balance = donated - released - refunded, using BigInt). `vaultLedger` turns events into a timeline. `indexerStatus` computes lag in blocks. **`reconcileVault`** asks the chain at the *same* block for the vault's own `getBalance()` and the token's `balanceOf(vault)` and requires all three numbers to be identical; `checkPayouts` additionally requires payouts <= releases and payouts == the Disbursement contract's own `disbursedTotal`. Any difference means "mismatch".
- `freshness.ts`: classifies lag (amber past 60 blocks).

### 8.7 `campaigns/`
- `validation.ts`: one zod schema used by browser and server (milestones must total 100, admin cap within ceiling).
- `ceilings.ts`: 10/15/20 mirror of the contract plus the category->enum index map. **Must match the contract.**
- `money.ts`: `rupeesToMinorUnits("1000.50")` -> `"1000500000"` (regex-validated, up to 6 decimals, via viem `parseUnits`, returns null if invalid). `formatMinorUnits` goes back to "₹1,000.50" with Indian digit grouping.
- `service.ts`: creates a campaign as DRAFT with null vault; saves the vault result after publishing.
- **`dashboard.ts`** `buildDashboard`: the single source for everything public (the page, `/ledger` API, and `/export` all call it, so they cannot disagree). `buildExpiry` mirrors the vault's close rules.
- `format.ts`: `formatIst` handwritten IST formatting (not `Intl`) so server and browser strings are identical (avoids React hydration mismatch). `export.ts`: CSV/JSON export. `network.ts`: Polygonscan links. `page-guard.ts`: page access checks.

### 8.8 Other domains (same pattern: `service.ts`, `chain-port.ts`, `fake-chain.ts`, `validation.ts`, `http.ts`, tests)
- **`organizers/`**: KYB flow `pending -> verified/rejected`; approval promotes the user's role and syncs `setOrganizerVerified` on-chain. `requireVerifiedOrganizer` gates campaign creation.
- **`donations/`**: see 8.9.
- **`escrow/`**: `service.ts` (`setRole`, `defineMilestonesOnChain`, `performAction`), `attestationCollector.ts`, `councilWorkflow.ts`. Rules: DB first then chain; revocation is chain first; the tx hash is saved before waiting; an unknown outcome stays PENDING.
- **`beneficiary/`**: `clientHasher.ts` (browser): `normalizeIdentityFragment` = Unicode NFKC + lowercase + collapse whitespace; `hashIdentityFragment` = `0x` + SHA-256(`salt` + `\0` + fragment), refusing empty input or salt. The NUL character prevents ambiguity between salt and fragment. Three layers stop duplicates: DB unique index, an on-chain pre-check, and the contract's revert.
- **`disbursement/`**: reads everything first (milestone Released, not already paid, remaining, organizer balance/allowance) so a bad request is refused **before gas is spent**, then `approve` (skipped if allowance suffices), then `disburse`.
- **`expiry/`**: close and refund routes' logic.
- **`files/service.ts`**: `saveDocument` re-hashes uploaded bytes and rejects a mismatch with the browser's hash; max 8 MB; only JPEG/PNG/WEBP/GIF/PDF.
- **`activity/`**: builds the public chain-activity timeline with plain-English sentences; never shows beneficiary fingerprints or payout references.
- **`nav/roles.ts`**: `roleHome` (where each role lands), `navLinksFor` (nav links per role), `identityChange` (detects that another tab signed in as someone else, since tabs share one cookie).
- `hash.ts`: browser-and-Node SHA-256 helpers (`sha256Hex`, `sha256HexOfFile`, `fileToBase64`).
- `explorer.ts`: builds Polygonscan URLs.

### 8.9 The donation state machine (`donations/advance.ts`), the cleverest part
A donation is **not** one request. Each step is a separate transaction and Amoy blocks take seconds.
1. `POST /api/v1/donations` records a PENDING donation (`step = "gas"`).
2. The browser calls `POST /donations/:id/advance` about every 1.5 s. Each call moves ONE step: `gas` (sponsor tops up POL) -> `mint` (faucet mints mINR to the donor) -> `fee` (only if a fee applies) -> `approve` (let the vault pull tokens) -> `deposit`.
3. Code walkthrough: `ORDER` lists the steps; `nextStep` skips `fee` when it is `"0"`; `acquire` is an **atomic lock**: an `UPDATE ... WHERE locked_until < now` that succeeds for only one caller (45 s lease), so two overlapping requests never send the same step twice; `sendStep` dispatches to the chain port; `runStep` sends the step, **saves the tx hash before waiting** (so a crash cannot lose a sent transaction), then waits briefly for the receipt.
4. Failure policy: if the transaction was reverted -> FAILED. If the chain is merely unreachable or slow -> stays PENDING and is rechecked, **never failed** (it may have succeeded). `fail()` stores a friendly per-step message and logs detail.
5. CONFIRMED only after `verifyDeposit` finds a `DonationReceived` event with the right vault, donor and amount in the receipt.

---

## 9. `apps/web/app/`: pages and API

### 9.1 Pages (what a user sees)

| Route | Page |
|---|---|
| `/` | Landing page. |
| `/how-it-works` | Plain-words explanation and glossary. |
| `/campaigns`, `/campaigns/[id]` | Public list and campaign page: ledger dashboard, reconciliation badge, donate panel, milestones, payouts, expiry panel. |
| `/organizers/[id]` | Public organizer profile. |
| `/activity` | Public chain-activity timeline with filters. |
| `/register`, `/login` | Account forms (in `(auth)` route group). |
| `/donations/[id]` | Donation receipt or resume. |
| `/dashboard` | Redirects to the user's role home. |
| `/dashboard/donor` | Balance and your donations. |
| `/dashboard/organizer` | Apply for / view KYB status. |
| `/dashboard/campaigns`, `/new`, `/[id]`, `/[id]/beneficiaries` | Organizer workspace: create, publish, define milestones, release, register beneficiaries, record payouts. |
| `/dashboard/attestor`, `/dashboard/council` | Role consoles. |
| `/dashboard/admin` | Review KYB applications (with document viewer) and grant attestor/council roles. |

`layout.tsx` wraps everything: loads three Google fonts, renders `SiteNav`, a skip-to-content link, the content container, and a footer stating it is a testnet demo. `globals.css` holds the design tokens (colors, focus styles).

### 9.2 Components (`apps/web/components/`)
`SiteNav` (role-aware navigation, polls session to warn if another tab changed identity), `AuthForm`, `OrganizerApplyForm` (hashes and uploads the KYB file), `AdminReviewList`, `RoleManager`, `CampaignForm`, `PublishCampaignButton`, `LedgerDashboard` (public dashboard, polls every 10 s while the tab is visible), `StageRail` (the four-stage donated/held/released/paid-out rail), `MilestoneCard`, `DonatePanel` + `DonationProgress` (drives the advance loop), `AttestForm` (hashes evidence then submits), `ActionButton`, `BeneficiaryForm` (hashes in the browser), `PayoutForm`, `ExpiryPanel` (close and refund buttons), `PageHead`, `LogoutButton`.

### 9.3 API routes (`app/api/v1/`)
| Group | Routes |
|---|---|
| auth | `register`, `login`, `logout`, `me`, `session` |
| organizers | `me`, `verify`, `[id]`; admin: `admin/organizers` (list, `decision`, `sync`), `admin/roles` |
| campaigns | `campaigns` (list/create), `[id]`, `[id]/deploy`, `[id]/milestones/define`, `[id]/ledger`, `[id]/export`, `[id]/beneficiaries` (+ `salt`), `[id]/close`, `[id]/refund` |
| donations | `donations`, `[id]`, `[id]/advance`, `[id]/retry` |
| milestones | `[id]`, `[id]/attestations`, `[id]/council-approval`, `[id]/release`, `[id]/disburse` |
| indexer | `status`, `reconcile`, `sync` |
| documents | `[id]` (role-gated by purpose: KYB admin-only, evidence admin/attestor/council) |
| activity | `activity` |

The `*.integration.test.ts` files call these route handlers directly against an in-memory SQLite database with only the chain mocked.

### 9.4 Anatomy of one route (read `donations/route.ts` this way)
1. `requireUser` -> 401 if no session.
2. Feature switch -> 503 `DONATIONS_NOT_CONFIGURED` if not set up.
3. `allow(...)` rate limit -> 429.
4. `readJson` -> 400 on bad JSON.
5. zod `safeParse` -> 400 with field errors.
6. `try { createDonation(...) }` and map each known error class to a specific status/code; unknown errors are logged and returned as `INTERNAL_ERROR` with no secrets.

---

## 10. End-to-end story to narrate (matches the screenshots in `media/`)

1. **Donor registers** -> a wallet is generated and its key encrypted (shot 02).
2. **Organizer applies** with a KYB document -> hash computed in the browser, file uploaded (03).
3. **Admin approves** -> DB status flips and `setOrganizerVerified` is sent to the Factory (04-05). Admin also grants attestor/council roles on-chain (07).
4. **Organizer creates a campaign** (title, goal, category, admin cap, deadline, milestones totaling 100) -> saved as DRAFT, then **Publish** deploys the vault through the Factory (06, 08-11). If the transaction fails there is a retry button (09).
5. **Donor donates 250 mINR** -> state machine runs gas, mint, approve, deposit (13-16). Ledger updates.
6. **Public chain activity** shows every event with Polygonscan links (17).
7. **Attestors confirm milestone 1** with evidence -> Verified (18).
8. **Release**: organizer (or anyone) triggers it; milestone 2 additionally needs council approvals (19-22).
9. **Beneficiary registered** as a hash, **payout recorded** through Disbursement (23-25).
10. **Reconciliation badge turns green**: indexed ledger = vault balance = token balance.

---

## 11. `docs/` folder

| File | Content |
|---|---|
| `Project_Overview.md` | High-level overview. |
| `VERA_MVP_SPDD.md` | Software design document: the architecture "source of truth"; code comments cite its sections ("SPDD §18.2"). |
| `VERA_MVP_Functional_Roadmap.md` | Requirements (FR-IDs) per module. |
| `Technical_Details.md` | Deep technical write-up (see corrections below). |
| `Additional_Features.md`, `FUTURE_CHANGES.md` | New (uncommitted) notes on extras and future work. |
| `PROGRESS_LOG.md` | Live log of what was done, costs, addresses, open items. |
| `manual_test_local.md`, `manual_test_live.md` | Free local and real-Amoy test walkthroughs. |
| `mining_instructions.md` | How to collect and sweep faucet POL. |
| `CLAUDE.md` | Working notes/conventions for the AI assistant used on this repo. |
| `Main Wallet.txt` | Wallet material. Do not open or show on screen. |

---

## 12. Corrections: say these accurately

`docs/Technical_Details.md` contains a few statements that do not match the code. Do not repeat them on stage:
1. **Section 7.1 title "Client-Side Custodial Wallet Security"**: the wallet is generated and encrypted **on the server** (`lib/auth/crypto.ts` uses Node's `crypto`). Say "server-side custodial wallet, key encrypted at rest with AES-256-GCM".
2. **Section 4.2 describes Selenium testing.** There is no Selenium and no committed browser test suite. Say: unit and integration tests with fake chains (483 pass), plus a scripted real-browser check (Playwright driving Chromium, run by hand, not committed), plus manual walkthroughs and local-chain end-to-end tests. The doc itself admits this in its "Honest status" paragraph.
3. `Deploy.s.sol` alone did not deploy everything on Amoy (only MockINR landed); the rest used `forge create`.

Also be upfront about design limits: the testnet token has an open faucet; the platform holds users' wallet keys (custodial) and is the gas sponsor; attestors and council are chosen by the admin (a trusted set, not decentralized); Disbursement cannot force an organizer to hand money over; there is no wallet-connect yet, so external wallets cannot donate or publish.

---

## 13. Likely questions and answers

- **Can the organizer steal the money?** Not from the vault: no function lets the organizer withdraw. Only the immutable manager can release, and only for Verified milestones, in order. Once released, the funds are with the organizer; Disbursement then makes payouts publicly recorded, and the reconciler flags mismatches.
- **What if attestors collude?** Needs at least 2 distinct attestors, the organizer can't be one, and releases over the limit also need 3 council approvals. (The limit and the number of approvals can be changed by the admin, never below 2; the limit is copied into each milestone when it is defined, so a change cannot loosen an existing one.)
- **What if an organizer registers people who do not exist?** An independent attestor must confirm each beneficiary before a payout is allowed. In the running app that is an app and database rule; with the V2 contracts (deployed on Amoy, not yet switched on) the payout contract itself refuses it. Say which one you mean.
- **Why not per-campaign limits?** That needs a new manager, Factory and Disbursement and re-registering every role (rated 9/10 risk), so it is on hold; the global limit and threshold are admin-controlled instead.
- **What if the campaign stalls?** After the deadline or the inactivity window, anyone can `close()` it, and donors reclaim their pro-rata share.
- **How do you prevent duplicate beneficiaries without storing identities?** Salted SHA-256 fingerprint made in the browser; unique per campaign in DB and on-chain.
- **How do you know the website isn't lying about totals?** Totals come only from indexed blockchain events, and the reconciler compares them to the vault and token balances at the same block with zero tolerance.
- **Why a testnet / fake rupee?** Zero cost, no regulatory issues; the design is identical to what a real stablecoin deployment would need.
- **What happens to a donation if the browser closes mid-way?** The state machine is resumable; each tx hash is saved before waiting; the next advance call continues.
- **What if gas spikes?** Sponsored actions refuse above 150 gwei.
- **Are the contracts upgradeable?** No, deliberately immutable. That is why expiry required a new Factory.
- **How was it tested?** 122 contract tests (including 10,000-run fuzzing), about 483 web tests with fake chains, Slither (0 high/medium), local-anvil end-to-end tests, and a real Amoy live test.

---

## 14. Demo checklist
1. Check `ls apps/web/.env*`: if `.env.development.local` exists the app is on the local chain, not Amoy.
2. Check the sponsor wallet balance with `cast balance` and `cast gas-price`.
3. Start with `pnpm dev`; use separate private windows per role (one cookie per browser profile).
4. Have `media/` screenshots ready as a backup if the RPC is slow.
5. Remember: the dev server caches env and DB; restart after changing `.env.local`.
