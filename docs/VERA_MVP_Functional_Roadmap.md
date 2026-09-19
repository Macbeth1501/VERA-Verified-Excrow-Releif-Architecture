# VERA MVP — Functional Implementation Roadmap

A high-level but detailed functional checklist for the 4-week testnet proof of concept. Each step states what to build, the business logic inside it, how it connects to the rest of the system, and how you know it's done.

---

## PHASE 1 — Foundations, Identity & On-Chain Skeleton (Week 1)

### Module 1.1 — Project Foundation & Shared Vocabulary
- **Sub-step 1:** Establish the single combined workspace that will hold the web application, the smart contracts, and any shared code, so the whole system lives and versions together as one unit.
- **Sub-step 2:** Define a shared set of data definitions (what a Campaign is, what a Milestone is, what a Donation is, what a Beneficiary is, and the allowed states each can be in). Every other module must reference this one shared vocabulary rather than inventing its own, so the frontend, backend, and chain layer never disagree about the shape of a record.
- **Deliverable/Outcome:** A running, empty application shell and a set of agreed data definitions that all later modules import — no feature yet, but a foundation where nothing can drift out of sync.

### Module 1.2 — Core On-Chain Escrow Skeleton
- **Sub-step 1:** Build the mock donation token — a stand-in for a real stablecoin that anyone can create for free on the test network. It must allow "topping up" a wallet on demand, which is how you simulate a donor converting money into spendable funds without any real payment.
- **Sub-step 2:** Build the campaign vault — the contract that actually holds a campaign's funds. It must accept deposits, report its current balance, announce every deposit as a public event, and protect itself against the classic "drain the funds mid-transaction" attack.
- **Sub-step 3:** Build the campaign factory — the contract that creates a fresh vault whenever an organizer launches a campaign. Its business rules: refuse to create a campaign if the organizer isn't verified, refuse if the administrative-expense cap exceeds the allowed ceiling for that category, and refuse if the milestone percentages don't add up to exactly 100%.
- **Sub-step 4:** Deploy this skeleton to the public test network and confirm each contract is visible and inspectable by anyone on a public block explorer.
- **Deliverable/Outcome:** A live, public, funds-holding escrow skeleton on the test network. A campaign can be created and money can be deposited into its vault, and any outside observer can independently verify it happened.

### Module 1.3 — Donor Identity & Onboarding
- **Sub-step 1:** Build donor sign-up so a person can create an account with an email and be given a usable test wallet automatically — without ever having to understand seed phrases or crypto jargon in the main flow. Allow the more advanced option of connecting an existing wallet for those who want it.
- **Sub-step 2:** Connect the account layer to the chain layer so that a newly registered donor immediately has a wallet address with a zero balance that the interface can display.
- **Deliverable/Outcome:** A stranger can register and, within about a minute, see their own (empty) wallet — proving the "no crypto literacy required" promise works end to end.

### Module 1.4 — Organizer Verification (Mock KYB)
- **Sub-step 1:** Build the organizer application flow: a charity/organizer submits their legal name, registration number, and a supporting document, and their status begins as "Pending."
- **Sub-step 2:** Build the approval logic. Because this is a zero-cost proof of concept, verification is handled manually by an administrator (or checked against a small pre-approved list) rather than a paid external registry. The rule that matters: only an organizer whose status becomes "Verified" may ever create a campaign; "Pending" and "Rejected" organizers cannot.
- **Sub-step 3:** Connect this status back to the campaign factory so the "must be verified" rule from Module 1.2 is enforced both in the application and independently on-chain.
- **Deliverable/Outcome:** A rejected or pending organizer is provably unable to launch a campaign, while a verified one can — and their verification details are publicly visible on their profile.

> **Week 1 Milestone:** A verified organizer account exists, and a bare, public escrow vault is live on the test network.

---

## PHASE 2 — Campaign Lifecycle & Public Transparency (Week 2)

### Module 2.1 — Campaign Creation
- **Sub-step 1:** Build the campaign creation experience where a verified organizer defines the campaign title, category (disaster relief, medical, or community), funding goal, administrative-expense cap, and a list of milestones. Each milestone has a description, a percentage of the total goal, and a required number of independent confirmations before its funds can be released.
- **Sub-step 2:** Implement the validation logic in three places for defense in depth — in the interface (instant feedback), in the backend (authoritative business check), and in the contract (final, non-bypassable check): milestone percentages must sum to exactly 100%, and the admin cap must not exceed the category ceiling.
- **Sub-step 3:** Wire the "create" action so a valid submission triggers the factory to deploy a real vault on the test network, and the campaign's descriptive details are saved off-chain for fast display.
- **Deliverable/Outcome:** A verified organizer can publish a real campaign with a genuine on-chain vault; any attempt to publish milestones that don't total 100% or that breach the admin ceiling is refused at every layer.

### Module 2.2 — On-Chain Event Reading / Indexing
- **Sub-step 1:** Build the mechanism that watches the chain and reads the key public events — campaign created, donation received, milestone released — and turns them into fast, queryable data for the interface.
- **Sub-step 2:** Establish the strict rule that any figure representing money or fund state is only ever written by this reading process, never edited directly by the application, so the displayed numbers can never silently diverge from the chain.
- **Deliverable/Outcome:** Any activity happening on the test network becomes queryable by the application within seconds, sourced purely from public chain events.

### Module 2.3 — Public Audit Dashboard
- **Sub-step 1:** Build the public campaign page that anyone can view without logging in, showing all inflows, each milestone's state, the running balance, and (with any beneficiary details redacted) the verification activity.
- **Sub-step 2:** Add near-real-time updating so the page reflects new donations shortly after they occur, and provide a downloadable export of the full audit trail.
- **Sub-step 3:** Connect the page's totals to the reading layer from Module 2.2 so they are always derived from chain events, not from a separate editable record.
- **Deliverable/Outcome:** A public, login-free transparency page whose totals can be independently reconciled against a public block explorer exactly — this is the core trust promise made visible.

> **Week 2 Milestone:** A campaign is publicly visible, updates in near-real-time, and reconciles precisely against independent block-explorer data.

---

## PHASE 3 — Money Movement: Donations, Escrow Release & Governance (Week 3)

### Module 3.1 — Donation Flow (Simulated Funding)
- **Sub-step 1:** Build the donation experience: a donor chooses an amount, the system tops up their wallet with the mock token (this stands in for converting real money), and then deposits that amount into the chosen campaign's vault.
- **Sub-step 2:** Enforce the fairness rule that distinguishes this platform from legacy ones — no pre-selected tip, and any platform fee is shown as a flat, clearly disclosed, non-preselected choice alongside a "no thanks / $0" option.
- **Sub-step 3:** Handle the failure case honestly: if a deposit is submitted but not yet confirmed on-chain, the donor sees a clear "pending" state; the system never marks a donation complete before the chain confirms it.
- **Deliverable/Outcome:** A donor can fund a campaign end to end, the money lands in the vault, the dashboard updates, and 100% of the confirmed amount is traceable on-chain net of only the disclosed fee.

### Module 3.2 — Milestone State Machine & Multi-Confirmation Logic
- **Sub-step 1:** Build the milestone-management contract that governs each milestone's lifecycle (pending → verified → released) and enforces the rule that a milestone cannot be released until it has collected its required number of independent confirmations.
- **Sub-step 2:** Implement the anti-fraud guard that prevents any single confirmer from being counted more than once toward a milestone's threshold, so one compromised or dishonest confirmer cannot fake sufficient verification alone.
- **Sub-step 3:** Embed the hard-coded administrative-expense ceiling directly in the contract so that any attempt to allocate more than the category allows is automatically rejected — making a "99% overhead" fraud a technical impossibility rather than a policy violation.
- **Sub-step 4:** Establish that only the milestone manager can trigger a release from the vault, and that this link is fixed permanently when the contracts are deployed — so no administrator or outside party can move funds another way.
- **Deliverable/Outcome:** Milestone funds are mathematically locked until genuinely verified; funds cannot be released below the confirmation threshold, cannot double-count a confirmer, and cannot breach the overhead cap.

### Module 3.3 — Attestation (Verification) Flow
- **Sub-step 1:** Build the flow by which a trusted verifier submits proof that a milestone was really achieved — a signed confirmation referencing evidence (such as a photo's fingerprint) — which the system validates and records on-chain.
- **Sub-step 2:** Connect this flow to the milestone manager so each valid, unique confirmation advances the milestone's count, and the milestone flips to "verified" only when the required number is reached.
- **Deliverable/Outcome:** Submitting fewer than the required confirmations leaves a milestone stuck in "pending" with no funds movable; submitting the final required one flips it to "verified" and the change is visible on the public dashboard.

### Module 3.4 — Multi-Party Council Approval for Large Releases
- **Sub-step 1:** Set up the approval council as a group of independent signer roles arranged so that no single role or organization holds a majority, and configure it to require multiple signatures (for example, three of five) before a large release can execute.
- **Sub-step 2:** Build the approval workflow: for a verified milestone, small releases below a set threshold happen automatically for speed, while releases above the threshold must gather the required council signatures before any funds move.
- **Sub-step 3:** Build the interface where council members review a pending release proposal and add their signatures, showing progress toward the threshold.
- **Deliverable/Outcome:** A large disbursement with too few signatures cannot execute, and one with enough signatures can — with the composition guaranteeing no single party can approve alone, directly answering the insider-collusion failure pattern.

> **Week 3 Milestone:** The full money loop works on the test network — donate, then verify a milestone, then obtain council approval, then release.

---

## PHASE 4 — Beneficiaries, Disbursement & Hardening (Week 4)

### Module 4.1 — Beneficiary Uniqueness Registry
- **Sub-step 1:** Build beneficiary registration where an organizer or field agent enters an identifying detail that is scrambled into an irreversible fingerprint inside the browser before anything is sent — so the platform never receives or stores the person's real identity.
- **Sub-step 2:** Build the duplicate-prevention logic that checks each incoming fingerprint against those already registered for that program, both in the application's records and independently on-chain, so the same real person cannot be registered twice as two "unique" beneficiaries.
- **Sub-step 3:** Make the rejection of a duplicate privacy-preserving: it reports that a duplicate exists with a reason code, without revealing which earlier program or record it clashed with.
- **Deliverable/Outcome:** Registering the same beneficiary twice in a program is refused with an auditable reason, no personal identity data ever leaves the browser in raw form, and the uniqueness claim is provable on-chain — directly closing the ghost-beneficiary fraud vector.

### Module 4.2 — Disbursement (Simulated Payout)
- **Sub-step 1:** Build the disbursement contract and flow that, once a milestone is released, moves the funds toward a beneficiary and records a payout reference back on-chain so every payout is a permanent, public line item.
- **Sub-step 2:** Because this is a no-real-money proof of concept, the actual bank/mobile-money transfer is simulated by logging a confirmed payout reference rather than calling a real payment provider.
- **Sub-step 3:** Enforce the guards: a payout can never exceed the amount released for that milestone, and any attempt to disburse for an unverified or already-paid milestone is refused.
- **Deliverable/Outcome:** A released milestone results in a recorded, on-chain-anchored payout to a registered beneficiary, and improper disbursement attempts are provably blocked.

### Module 4.3 — Security Review & Reconciliation Hardening
- **Sub-step 1:** Stress-test every fund-moving contract behavior with automated randomized inputs and free static-analysis tooling, resolving anything flagged as serious before considering the build done.
- **Sub-step 2:** Manually review every point where a contract hands control to an outside call, confirming the funds cannot be re-entered or drained during that handoff.
- **Sub-step 3:** Run the reconciliation check that compares every figure shown on the dashboard against the raw chain data, treating any mismatch as a release-blocking defect rather than a rounding footnote — because a divergence between reported and actual numbers is the root of every fraud case the project is built to prevent.
- **Deliverable/Outcome:** A hardened system with no serious outstanding findings and a demonstrated, perfect match between what the dashboard shows and what the chain actually holds.

> **Week 4 Milestone (Final):** The complete lifecycle — donate → escrow → verify → council-approve → release → simulated payout — is demonstrated end to end on the test network, security-reviewed, with every displayed figure independently reconcilable.

---

## How the Modules Connect (System Flow Summary)
- Identity (1.3, 1.4) gates Campaign Creation (2.1): only verified organizers create campaigns, and the factory re-checks this on-chain.
- Campaign Creation (2.1) produces the vault that Donations (3.1) fund and that Event Reading (2.2) watches.
- Event Reading (2.2) feeds the Public Dashboard (2.3), guaranteeing displayed totals always trace to the chain.
- The Milestone Manager (3.2) is the only path to release vault funds; it is fed by Attestations (3.3) and gated by Council Approval (3.4) for large amounts.
- The Beneficiary Registry (4.1) must confirm a unique recipient before Disbursement (4.2) can pay out a released milestone.
- Hardening (4.3) validates the whole chain of custody and proves the transparency promise holds.

## Non-Negotiable Sequencing
- Contracts skeleton before campaign creation. Organizer verification before campaign creation.
- Event reading before the public dashboard.
- Milestone manager before attestations before council approval.
- Beneficiary registry before disbursement.
- Hardening and reconciliation come last, after all fund-moving logic exists.
