# VERA: Future Changes Spec

Written 2026-10-30, against commit `98efa1f` (26 Oct 2026). Each change below is a self-contained brief for Claude Code. Do them **one at a time**, in the order given, and only the ones the user names.

## Ground rules for every change

1. **Follow `docs/CLAUDE.md` and the working agreement in `docs/PROGRESS_LOG.md`.** One change at a time, explain what and why, fix errors before moving on, and add a History entry to `PROGRESS_LOG.md` when a change is finished.
2. **The user does all git commits, pulls and pushes.** Work on a branch the user creates (suggested name per change below), so `main` stays the working demo.
3. **Testnet POL rule.** Never send an Amoy transaction to "try it out". Prove every chain path on a local anvil chain first (`docs/manual_test_local.md`). Ask before any Amoy deploy or live test, state the cost, check `cast gas-price` and the sponsor balance first, and cap gas.
4. **Do not touch** `apps/web/data/vera.db*`, `apps/web/.env.local` contract addresses, or `WALLET_ENCRYPTION_KEY`. The live walkthrough data lives there.
5. **No contract redeploy** unless the change says so explicitly and the user approves it.
6. **Definition of done** for every change: `pnpm test` (forge) and `pnpm test:web` pass, `tsc --noEmit` and `eslint .` are clean, new tests exist for the new behaviour, and the affected pages are opened in a real browser with no console errors.
7. **Keep the floors.** `MIN_REQUIRED_ATTESTATIONS = 2` and `MIN_COUNCIL_THRESHOLD = 2` are core safety claims of the project. No change may lower or bypass them.

## Overview

| ID | Change | Contract redeploy? | Risk of breaking the demo | When |
|---|---|---|---|---|
| C2 | Admin can change the council-approval limit (global, existing contract function) | No | 4/10 | Only if fully tested locally before the presentation; otherwise after |
| C3 | Guard: required confirmations cannot exceed active attestors | No | 2/10 | After the presentation |
| C4 | Admin can change the council approvals needed (global K) | No | 4/10 | After the presentation |
| C5 | Attestors verify beneficiaries (app-enforced) | No | 5/10 | After the presentation |
| C6 | Attestors verify beneficiaries (contract-enforced) | Yes: Registry v2 + Disbursement v2 | 6/10 | After C5 |
| C7 | True per-campaign limit and council threshold | Yes: Manager v2 + Factory + Disbursement | 9/10 | **ON HOLD** (user decision 2026-11-06) |

Explicitly rejected: letting **attestors** (or organizers) set the council limit or thresholds. The limit decides whether the council checks the attestors' own work, so an attestor setting it is a conflict of interest and breaks the separation-of-duties claim.

---

## C2. Admin can change the council-approval limit (auto-release limit)

**Branch:** `feat/admin-release-limit`  **Risk:** 4/10  **POL:** one sponsored transaction each time the admin saves a new value (about 0.002 POL at 30 gwei); development and testing on local anvil cost 0

> **Status: BUILT 2026-11-06, proven on the fake chain and a local anvil chain only (0 POL).** Deviations from the brief: the pure rupees parser lives in `lib/escrow/release-limit.ts` (client-safe, shared by the form and the API) rather than only in `validation.ts`; the optional `AutoReleaseLimitSet` indexing (item 7) was skipped, as the brief allowed; the sponsor gas-price refusal is applied inside `sendAsSponsor` for this call. Browser check still to do.

### Current state (important: read before designing)
- The deployed `MilestoneManager` (`0xe6d7222dDe3eE4b9688269427631aDF49229e747`) already has `setAutoReleaseLimit(uint256 limit) external onlyOwner` and a public `autoReleaseLimit()` view, and emits `AutoReleaseLimitSet(limit)`. **No contract change or redeploy is needed.**
- The owner of the manager is the deployer/sponsor wallet, i.e. the key in `FACTORY_OWNER_KEY`.
- The limit is **snapshotted into each milestone when it is defined** (`Milestone.autoReleaseLimit`, set in `defineMilestone`). So a new value only applies to milestones defined afterwards, i.e. to campaigns published after the change. Milestones already on-chain (including the live demo campaign) keep the limit they were defined with. This is a deliberate safety property: an admin cannot later skip the council for an existing milestone.
- Current value: 100 mINR = `100000000` minor units (6 decimals).
- The app already reads each milestone's snapshot (`lib/chain/manager.ts` → `readMilestone` → `MilestoneState.autoReleaseLimit`), and `components/MilestoneCard.tsx` uses it to decide whether council approval is needed. That logic does not need to change.

### What to build
1. **Chain module** `lib/chain/manager.ts`:
   - Add `"function setAutoReleaseLimit(uint256 limit)"` and `"function autoReleaseLimit() view returns (uint256)"` to `managerAbi`.
   - Widen `sendAsSponsor`'s `functionName` union to include `"setAutoReleaseLimit"`.
   - Before sending, call `gasPriceRefusal` from `lib/chain/sponsor.ts` and refuse above 150 gwei, as other sponsored actions do.
2. **Port** `lib/escrow/chain-port.ts` (`EscrowChain`): add
   - `readAutoReleaseLimit(): Promise<string | null>` (minor units as a string; null when the chain cannot be read), and
   - `setAutoReleaseLimit(minorUnits: string): Promise<Tx>`.
   Implement both in `lib/escrow/fake-chain.ts` too (it already has an `autoReleaseLimit` field).
3. **Service** (new function in `lib/escrow/service.ts`, or a small new `lib/escrow/limits.ts`):
   - `getReleaseLimit(chain)` returns the current global value and whether the chain is configured or readable.
   - `setReleaseLimit(chain, minorUnits)` validates, sends, and returns the tx hash. If the outcome is unknown, report it as pending and never as failed (same rule as the rest of the escrow code).
4. **Validation** in `lib/escrow/validation.ts`: input is in rupees from the form and is converted with `rupeesToMinorUnits` from `lib/campaigns/money.ts`. Rules: whole or 2-decimal rupees; minimum 0; maximum 10,000,000 rupees (sanity cap). A value of 0 is allowed and means "every release needs council approval".
5. **Route** `app/api/v1/admin/release-limit/route.ts`:
   - `GET` returns `{ limitMinorUnits, configured }`.
   - `POST { limitRupees }` sets it.
   - Both are **admin only**, using `requireUser(request, "admin")` (role read from the database). Use the standard error envelope and the existing escrow rate-limit bucket. Return 503 when the chain cannot be read, never a guessed value.
6. **UI**: a new section on `/dashboard/admin` (`app/dashboard/admin/page.tsx`), below "Roles", titled "Council approval limit", with a small client component (follow `RoleManager.tsx` for style and the button and pending states):
   - Show the current limit read from the chain (`₹100.00`).
   - Input with a Save button, and a confirmation step before sending, because it is a real transaction.
   - State plainly: "Applies to campaigns published after this change. Campaigns already published keep the limit they were published with."
   - Warn when the new value is very high (for example above the largest campaign goal): "Releases up to this amount will not need council approval."
   - Show the tx hash with a Polygonscan link after success.
7. **Optional, nice for transparency:** index `AutoReleaseLimitSet` from the manager stream (`lib/chain/reader.ts`, `lib/indexer`) so `/activity` shows when the admin changed it. Skip this if it adds risk.
8. **Docs:** a History entry in `PROGRESS_LOG.md`; mention the new admin control in `docs/manual_test_local.md` and `docs/manual_test_live.md`; update the line in `Technical_Details.md` that calls the limit fixed.

### Tests
- Validation: negative, non-numeric, more than 2 decimals, over the cap (all rejected); 0 accepted; `"250.5"` → `"250500000"`.
- Routes: non-admin gets 403, signed-out gets 401, not configured gets the existing not-configured code, an unreadable chain gets 503, success returns the hash.
- Fake chain: after `setAutoReleaseLimit`, a **newly defined** milestone snapshots the new value and an **already defined** one keeps the old value (this proves the safety property end to end in the app).
- Local anvil: deploy the contracts per `manual_test_local.md`, change the limit from the admin page, publish a campaign, and check with `cast call <manager> "getMilestone(address,uint256)" <vault> 0` that its snapshot equals the new value.

### Acceptance
- Admin sees and changes the limit; non-admins cannot reach the route or the section.
- Existing campaigns are unaffected (verify on local anvil).
- All tests pass, and no Amoy transaction was sent during development.

### Presentation note
If this is merged before the demo, **do not change the live limit on Amoy before or during the presentation** unless it has been rehearsed. Showing the admin section and explaining the snapshot rule is enough.

---

## C3. Guard: required confirmations cannot exceed active attestors

> **Status: BUILT 2026-11-06** (see `PROGRESS_LOG.md`). Deviation from the brief: the check lives in the route (`app/api/v1/campaigns/route.ts`), not `lib/campaigns/service.ts`, because `lib/escrow/service.ts` already imports the campaigns service (a cycle), and it applies only when escrow is configured. Browser check still to do.

**Branch:** `fix/attestation-count-guard`  **Risk:** 2/10  **POL:** none

### Problem
The campaign form and API accept `requiredAttestations` from 2 to 10 per milestone (`lib/campaigns/validation.ts`), but nothing compares it with how many attestors actually exist. With 2 attestors, a milestone created with M = 3 can **never** be verified, and its money is stuck until the expiry and refund path. The contract cannot check this (the attestor list is a mapping and cannot be counted on-chain), so the app must.

### What to build
1. A helper that counts **active, on-chain-synced** attestors from `role_grants` (see `listRoleGrants` and `roleIsSynced` in `lib/escrow/service.ts`).
2. In `POST /api/v1/campaigns` (the create service in `lib/campaigns/service.ts`), refuse with 422 `VALIDATION_FAILED` and a field error on the milestone when `requiredAttestations > activeAttestors`, worded as "Only N attestors are registered; ask an admin to add more or lower this number."
3. In `CampaignForm.tsx`, show "N attestors are registered" next to the field, and cap the input. Read the count from a small public or organizer-only endpoint, or pass it in from the server page.
4. On the admin page, when removing an attestor would leave fewer attestors than some live, unverified milestone needs, show a warning (warn only, do not block).

### Tests
Service and route tests for: M within the count (accepted), M above it (rejected with the field error), zero synced attestors (rejected with a clear message).

---

## C4. Admin can change the council approvals needed (global K)

> **Status: BUILT 2026-11-06**, proven on the fake chain and a local anvil chain only (0 POL). The live value was read first: `councilThreshold()` = 3. Deviation: the in-flight list is shown inside the confirmation step (computed in the browser from the server's list), not as a separate page. Browser check still to do.

**Branch:** `feat/admin-council-threshold`  **Risk:** 4/10  **POL:** one sponsored transaction per change

### Current state
- The deployed manager has `setCouncilThreshold(uint256) external onlyOwner` (it reverts below 2) and a `councilThreshold()` view. No redeploy is needed.
- **Unlike the release limit, K is not snapshotted.** `release()` compares against the current `councilThreshold` at release time, so a change applies immediately to every milestone already waiting for council approval.
- The progress log records the deployed value as 3. **Verify it on-chain first** with `cast call 0xe6d7222dDe3eE4b9688269427631aDF49229e747 "councilThreshold()(uint256)" --rpc-url <amoy rpc>`, and report the value to the user before doing anything.

### What to build
Same structure as C2 (ABI entry, `sendAsSponsor` union, port method, fake chain, service, admin-only route `app/api/v1/admin/council-threshold/route.ts`, and an admin section), with these extra guards:
1. Reject K < 2, matching the contract floor.
2. Reject K greater than the number of **active, synced council members**. Otherwise every release above the limit is frozen.
3. Before confirming, list the milestones that are currently Verified, above their limit and waiting for council, and say how the change affects each one ("now releasable" or "now needs one more approval").
4. Show the current K on the council console (`/dashboard/council`) as well.

### Tests
Floor, ceiling (council count), the in-flight warning list, admin-only access, and a fake-chain release that flips from refused to allowed when K is lowered.

---

## C5. Attestors verify beneficiaries (app-enforced)

> **Status: BUILT 2026-11-06** (app-enforced only; browser check still to do). Deviations from the brief: the shared counting code is in `lib/beneficiary/verification.ts` (avoids an import cycle); an attestor needs the `attestor` role but not an on-chain-synced role, because the check never touches the chain; attesting a fingerprint that matches nobody answers `{ matched: false }` with HTTP 200 and stores nothing; the public campaign text "verified unique beneficiary" now reads "unique beneficiary" so "verified" means attestor-verified only.

**Branch:** `feat/beneficiary-attestation`  **Risk:** 5/10  **POL:** none for the app version

### Problem
`BeneficiaryRegistry` proves a beneficiary is **unique** within a campaign, but not that they **exist**. Only the organizer registers beneficiaries, and `Disbursement` only checks `isRegistered`, so an organizer could register people who do not exist and record payouts to them. This is the remaining trust gap at the end of the pipeline.

### Design (preserves the privacy rule: identity text never reaches the server)
- An attestor visiting the field gets the campaign's program salt. This means extending `getProgramSalt` access in `lib/beneficiary/service.ts` from organizer and admin to **attestors** as well; note the trade-off in `PROGRESS_LOG.md`.
- The attestor types the person's identity fragment in their own browser. `lib/beneficiary/clientHasher.ts` produces the fingerprint, and the attestor submits only the hash plus an optional evidence hash or upload (reuse the `documents` table with a new purpose, `beneficiary_evidence`).
- If the hash matches a registered beneficiary of that campaign, record an attestation. A different attestor can attest the same beneficiary, but the same attestor cannot attest twice, and the campaign's own organizer can never attest.
- A beneficiary becomes **Verified** after `BENEFICIARY_REQUIRED_ATTESTATIONS` (default 1, configurable by env; 2 is stronger) distinct attestations.

### What to build
1. Migration `0010_beneficiary_attestations`: table `beneficiary_attestations (id, beneficiary_id, attestor_user_id, evidence_hash, evidence_document_id, created_at)` with a unique index on `(beneficiary_id, attestor_user_id)`. Store the verified status as a derived count, not as a status column that can drift.
2. Service `lib/beneficiary/attestation.ts`: `attestBeneficiary`, `beneficiaryVerification(campaignId)`.
3. Route `POST /api/v1/campaigns/:id/beneficiaries/attestations` (attestor only, per-user rate limit like the beneficiary route), and allow attestors on `GET .../beneficiaries/salt`.
4. UI: a "Verify beneficiaries" section on `/dashboard/attestor` (pick a campaign, type the details, submit; show matched or no-match without revealing anything else). On the organizer's beneficiaries page, show "verified by N attestors" per row.
5. **Payout gate:** in `lib/disbursement/service.ts` `disburseMilestone`, refuse a payout to an unverified beneficiary with 409 `BENEFICIARY_NOT_VERIFIED`. Mark this clearly as an app-level rule, because the contract does not enforce it until C6.
6. Public campaign page: "N of M beneficiaries verified by independent attestors".
7. Existing beneficiaries stay valid but show as "not yet verified".

### Tests
Match and no-match, organizer cannot attest, the same attestor twice, threshold reached, the payout refused before verification and allowed after, no raw identity text anywhere in requests or the database, and a non-attestor refused.

### Honesty note for docs and pitch
In C5 the verification is enforced by the app and the database, not the chain. Say so in `PROGRESS_LOG.md` and `Technical_Details.md`.

---

## C6. Attestors verify beneficiaries (contract-enforced)

> **Status: PARTS 1-4 BUILT 2026-11-06 (local only, 0 POL); part 5, the Amoy deploy, awaits the user's approval.** Part 1: `BeneficiaryRegistryV2.sol` and `DisbursementV2.sol` exist with 28 Foundry tests (fuzz at 10,000 runs; `forge test` 122/122) and a Slither run with no medium/high finding. **Parts 2-4 BUILT 2026-11-06 (local only):** (2) app wiring behind an explicit `BENEFICIARY_REGISTRY_V2=1` flag: the registry port gained `attest`, signed by the attestor's wallet; `beneficiary_attestations` gained a chain status (migration `0011`); only CONFIRMED rows count in that mode; (3) the indexer's registry stream reads `BeneficiaryAttested` and `/activity` shows it; (4) the full payout flow ran on a fresh local anvil with the V2 contracts (and again with the original ones). Deviation: V1 vs V2 is an explicit env flag rather than auto-detected, because a transient RPC error must never silently turn verification off; the app also does not pre-read `isVerified` before a payout, since its own confirmed-row count matches it and the contract is the authority. **Part 5 DONE 2026-11-06 on the user's instruction:** deployed to Amoy (registry `0xF1C72cF2D5722a837305424D1966BBBe7F73454a`, disbursement `0xba49F68CabB0389091B4767aedfFc90B182f7Bd2`) and checked live with one real registration, on-chain attestation and payout (0.2724 POL in all). `.env.local` is not switched. **Original wording of part 5, kept for the record:** ask the user to approve the Amoy deploy (two contracts, about 0.05 POL, re-registering beneficiaries). Nothing is deployed. Deviation: `DisbursementV2` imports `IVault`/`IManager` from `Disbursement.sol` rather than redeclaring them.

**Branch:** `feat/registry-v2`  **Risk:** 6/10  **POL:** two contract deploys (about 0.05 POL total at 30-40 gwei) plus the live test. **Needs the user's approval.**

### Design
- `BeneficiaryRegistryV2`: keep `register` exactly as today, and add `attestBeneficiary(vault, identityHash)`. Only an `isAttestor` on the manager may call it (read through an interface to the existing MilestoneManager), never the vault organizer, and each attestor counts once. Add `attestationCount(vault, hash)`, `isVerified(vault, hash)` (count ≥ a constructor-set `requiredAttestations`, minimum 1) and an event `BeneficiaryAttested`.
- `DisbursementV2`: identical to `Disbursement`, but it checks `registry.isVerified(...)` instead of `isRegistered`, with error `BeneficiaryNotVerified`.
- **Unchanged:** MilestoneManager, CampaignFactory, vaults and MockINR. Existing campaigns keep working. Beneficiaries must be re-registered on the new registry.

### Steps
Contracts and Foundry tests (including fuzz) → Slither (record findings) → app port and chain modules pointed at the new addresses through env vars → indexer stream for the new events → a full run on local anvil (`live-local` style test) → only then ask the user about deploying to Amoy.

---

## C7. True per-campaign release limit and council threshold

> **Status: ON HOLD (user decision, 2026-11-06). Not started, and not to be started without a fresh, explicit go-ahead.** Reasons: it needs a new MilestoneManager, Factory, Disbursement and registry, re-registration of every organizer and role, and an app that supports two managers side by side; it is rated 9/10 risk, and C2 to C6 already cover the practical problems (an admin-controlled global limit and K, attestor-verified beneficiaries, contract enforcement). If it is ever resumed, start with a local-only design and contract pass and bring the migration plan for approval before any Amoy deploy.

**Branch:** `feat/manager-v2`  **Risk:** 9/10  **POL:** a full redeploy plus re-registration of organizers and roles. **Long-term only; do not start without explicit approval.**

### Why it is big
Vaults bind their manager permanently (`immutable`), and `Disbursement` and `MilestoneManager` reference each other immutably. Per-campaign values need a new manager that stores `autoReleaseLimit` and `councilThreshold` per vault, set once at publish and never changeable afterwards. That in turn needs a new Factory (new vaults), and a new Disbursement and registry pointing at the new manager. Every existing campaign stays on the old system.

### Design sketch
- `MilestoneManagerV2.configureVault(vault, autoReleaseLimit, councilThreshold)`, callable once per vault, only by the vault organizer or the factory, with a threshold of at least `MIN_COUNCIL_THRESHOLD` and at most the active council count supplied by the owner. Alternatively, the Factory passes the values at creation.
- Optionally, per-campaign attestor and council pools chosen at publish. This raises the question of whether the admin picks friendly attestors, so document the trust model if it is built.
- Migration plan for the app: support two manager addresses side by side, so old and new campaigns both display.

---

## Suggested prompts for Claude Code

- "Read `docs/FUTURE_CHANGES.md` and implement **C1** only. Follow the ground rules. Stop when its acceptance checks pass and tell me what changed."
- "Implement **C2** from `docs/FUTURE_CHANGES.md` on local anvil only. Do not send any Amoy transaction. Stop after the local acceptance checks."
