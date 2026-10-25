# Manual test guide (LIVE): run and test VERA on the real Polygon Amoy testnet

> **This guide spends testnet POL.** For the free local-chain version (anvil, no POL) use [`manual_test_local.md`](manual_test_local.md). Read the "Testnet POL rule" in `CLAUDE.md` first: spend POL only when strictly necessary, and ask before a live run.

This is a complete, self-contained walkthrough. You will register eight accounts, make one of them the admin, approve an organizer, hand out the attestor and council roles, publish a campaign, donate, confirm milestones, release the money, register a beneficiary, record a payout, and check the public audit page, all on the real Amoy blockchain. Nothing is deployed by this guide: the contracts already exist.

All commands are for **Git Bash** on Windows. Replace paths if your project lives somewhere else.

**How to read this guide.** Every step says: *who* does it (which account, in which browser window), *where* (the exact page), *what to type or click* (the exact field and button names as they appear on screen), *what you should see* and *what it costs*.

---

## 0. Status: the new Factory is already deployed (done 2026-10-26)

The app publishes campaigns with an **end date and an inactivity rule** (6-argument `createCampaign`). The old Factory on Amoy only had 4 arguments, so a **new Factory was deployed on 2026-10-26** and `apps/web/.env.local` now points at it. Publishing, end dates and donor refunds all work on the real chain. You do **not** need to deploy anything; skip straight to section 1. (Part A below is kept only as the record of what was done, and as the recipe if a Factory ever has to be redeployed.)

| New Factory | Value |
|---|---|
| Address | `0xcBA47322e213107C19Be706e6817629744A42364` |
| Deploy block (`INDEXER_START_BLOCK`) | `51136547` |
| Deploy tx | `0xb9b560b22233735be7b590f66fe2988d5903255a315eb04a9cbf69089cfd4bca` |
| `setMilestoneManager` tx | `0x54fe0b2fbab2354c490fbc158ff1632293dfbc5e0b5d0e29def4dd3330cf9b97` |
| Cost | about 0.094 POL (sponsor 50.643 to 50.549) |

No organizer is registered on it yet: the admin's **Approve** in Step 3 does that. The old Factory's campaigns (#0-#3) no longer appear in the app, which is expected.

---

## Part A (record only, already done). How the new Factory was deployed

1. **Check the sponsor wallet and gas price** (free):
   ```bash
   cd /c/Users/Rochan/Desktop/Coding/Projects/vera-mvp
   R=$(grep -E '^RPC_URL=' apps/web/.env.local | cut -d= -f2- | cut -d, -f1)
   cast balance 0xb2Ab1471d98909237B3F3828E7422182584E11E3 --rpc-url "$R" --ether
   cast gas-price --rpc-url "$R"
   ```
   Need at least 1 POL and a gas price under about 60 gwei. If gas is higher, wait. (Amoy once spiked to 570 gwei and a single deploy cost 1.41 POL.)

2. **Build the current contracts** (free): `cd contracts && forge build`

3. **Deploy the new Factory.** The constructor argument is the existing MockINR address. `--constructor-args` must be the **last** option, and always cap the price with `--gas-price`:
   ```bash
   cd /c/Users/Rochan/Desktop/Coding/Projects/vera-mvp/contracts
   K=<the FACTORY_OWNER_KEY value from apps/web/.env.local>
   forge create src/CampaignFactory.sol:CampaignFactory --rpc-url "$R" --private-key "$K" --broadcast \
     --gas-price 40gwei --constructor-args 0x9b6f00a1ce627a3e0d2da601253704084d8fc52c
   ```
   Copy the `Deployed to:` address (call it `NEW_FACTORY`) and read its block number: `cast receipt <deploy tx hash> blockNumber --rpc-url "$R"` (call it `NEW_BLOCK`).

4. **Point the new Factory at the existing milestone manager** (every vault binds to the manager, so this must happen before any campaign is published):
   ```bash
   cast send NEW_FACTORY "setMilestoneManager(address)" 0xe6d7222dDe3eE4b9688269427631aDF49229e747 \
     --rpc-url "$R" --private-key "$K" --gas-price 40gwei
   cast call NEW_FACTORY "milestoneManager()(address)" --rpc-url "$R"   # must print 0xe6d7...9747
   ```

5. **Edit `apps/web/.env.local`**: set `FACTORY_ADDRESS=NEW_FACTORY` and `INDEXER_START_BLOCK=NEW_BLOCK`. Leave every other address as it is (MockINR, manager, registry and Disbursement are reused unchanged).

6. **Restart `pnpm dev`** after any `.env.local` change (it caches the settings).

7. Tell Claude the two new values so the docs and `docs/PROGRESS_LOG.md` are updated (project rule: record the spend and new balance).

Organizers must be **re-registered on the new Factory**. That happens automatically in Step 5 below (the admin's Approve button sends `setOrganizerVerified` to whichever Factory is in `.env.local`), which is why this guide uses fresh accounts.

---

## 1. What you will have open

| Window | Purpose |
|---|---|
| **Terminal B: commands** | One-off commands (balance checks, promote admin) |
| **Terminal C: app** | Runs the website (`pnpm dev`) |
| **Browser window 1 (normal)** | Signed in as the **admin** (and reused for the public pages) |
| **Browser window 2 (private/incognito)** | Signed in as **everyone else**, one person at a time |

There is no chain terminal: Amoy is already running. To open Git Bash: Windows key, type `Git Bash`, Enter (or in VS Code: Terminal, New Terminal, pick Git Bash).

**One browser profile is one person.** All windows of the same profile share one login cookie. If you sign in as someone else in a second window of the same profile, the first window shows an amber *"Another window signed in as ..."* warning. That is why you use a normal window plus a private window. Inside the private window you must **Sign out** (top bar) and **Sign in** again every time the guide says "now become X". Closing the private window also signs you out.

---

## 2. What is already deployed (Polygon Amoy, chain 80002)

| Contract | Address | Role |
|---|---|---|
| MockINR | `0x9b6f00a1ce627a3e0d2da601253704084d8fc52c` | Test rupee token (6 decimals) |
| CampaignFactory (current, 6 args) | `0xcBA47322e213107C19Be706e6817629744A42364` | Creates one escrow vault per campaign. Replaced the old 4-argument Factory `0x6931E776da5db1D9e5890407FE268705D70740bD` on 2026-10-26 |
| MilestoneManager | `0xe6d7222dDe3eE4b9688269427631aDF49229e747` | Attestations, council, release |
| BeneficiaryRegistry | `0xA4BF48D348246f66281B8Ca191F3981e15E5C54D` | Unique beneficiary fingerprints |
| Disbursement | `0x8305ECfbd9365efF27efD6f360C36589C006e5eA` | Records payouts to beneficiaries |

**Sponsor wallet** (the platform's gas wallet and Factory owner): `0xb2Ab1471d98909237B3F3828E7422182584E11E3`. It pays gas for **every** action in this guide, including actions that appear to be done by an organizer, donor, attestor or council member (their own generated wallets are topped up with a little POL first, and that gas stays in their wallets afterwards). Factory campaigns #0-#3 are demo-only and unrelated.

---

## 3. Pre-flight checklist (free, read-only)

Do all of this before the first click. None of it spends POL.

1. **No local override.** Run `ls -a apps/web | grep '^\.env'`. You must see `.env.local` and may see `.env.development.local.bak`. If you see a plain `.env.development.local`, rename it: `mv apps/web/.env.development.local apps/web/.env.development.local.bak`. That file silently redirects `pnpm dev` to a local chain (campaigns would appear to work but never touch Amoy).
2. **`.env.local` is complete.** It must contain all of: `DATABASE_URL`, `AUTH_SECRET`, `WALLET_ENCRYPTION_KEY`, `MOCK_INR_ADDRESS`, `RPC_URL`, `FACTORY_ADDRESS`, `INDEXER_START_BLOCK`, `FACTORY_OWNER_KEY`, `MILESTONE_MANAGER_ADDRESS`, `MANAGER_START_BLOCK`, `BENEFICIARY_REGISTRY_ADDRESS`, `REGISTRY_START_BLOCK`, `DISBURSEMENT_ADDRESS`, `DISBURSEMENT_START_BLOCK`. Check without printing secrets: `sed 's/=.*/=<set>/' apps/web/.env.local`. (As of 2026-10-26 all fourteen are present.) Without `FACTORY_OWNER_KEY`, publishing, donating and syncing say "not configured".
3. **Sponsor balance and gas price** (the commands in Part A step 1). Keep at least 1 POL. The app refuses sponsored actions above 150 gwei; if `cast gas-price` shows something near that, wait.
4. **The contracts exist.** For each address in section 2, `cast code <address> --rpc-url "$R"` must print long hex. `0x` alone means nothing is deployed there.
5. **Protect the database.** The file `apps/web/data/vera.db` (created on first run) holds every generated wallet, encrypted with `WALLET_ENCRYPTION_KEY`. Never delete it and never change that key. Right now `apps/web/data/` holds only `backup-2026-10-03/` (the old accounts), so **the app starts with no accounts and no campaigns, and that is fine**: this guide creates fresh ones. (To get the old accounts back you would copy the three `vera.db*` files from the backup into `apps/web/data/`, using the same key. You do not need to.)
6. **Write down the starting sponsor balance.** You will compare it at the end.

---

## 4. Start the website

In **Terminal C**:

```bash
cd /c/Users/Rochan/Desktop/Coding/Projects/vera-mvp
pnpm dev
```

Wait for `Ready`, then open http://localhost:3000 in **browser window 1**. The database is created and migrated automatically on the first request. Stop any other `pnpm dev` first (only one can run, and an old one has old settings). Restart `pnpm dev` whenever you change `.env.local`.

---

## 5. The eight accounts (what each one is for)

Create these with the password **`correct-horse-battery`** (at least 12 characters; the same for all, for convenience). Emails need not be real; they only need to be recognisable.

| # | Email | Role in this test | Becomes that role by | Used in steps |
|---|---|---|---|---|
| 1 | `live-admin@test.com` | **Admin**: approves organizers, grants attestor and council roles | Command line (Step 2) | 2, 3, 4 |
| 2 | `live-org@test.com` | **Organizer**: applies, creates and publishes the campaign, releases money, registers a beneficiary, records a payout | Applying and being approved (Step 3) | 3, 5-8, 10, 11 |
| 3 | `live-donor@test.com` | **Donor**: donates 250 mINR | Nothing: every new account is a donor | 6 |
| 4 | `live-att1@test.com` | **Attestor 1**: confirms milestones are complete | Admin grants "Attestor" (Step 4) | 7, 8 |
| 5 | `live-att2@test.com` | **Attestor 2**: the second confirmation (a milestone needs 2 different people) | Admin grants "Attestor" | 7, 8 |
| 6 | `live-c1@test.com` | **Council member 1** | Admin grants "Council member" | 9 |
| 7 | `live-c2@test.com` | **Council member 2** | Admin grants "Council member" | 9 |
| 8 | `live-c3@test.com` | **Council member 3** (the third approval makes the large release possible) | Admin grants "Council member" | 9 |

Why so many: the system deliberately splits power. The organizer cannot confirm their own milestones (conflict of interest), a single attestor cannot verify a milestone alone, and a large release needs three council members. The organizer and admin may not be attestors.

Every account gets its own generated blockchain wallet automatically. You never see or handle a private key.

---

## 6. The walkthrough

Approximate costs are from past runs at 30-50 gwei. Budget **about 0.5 POL** for the whole walkthrough, on top of Part A.

### Step 1. Register the eight accounts (cost: 0 POL)

Repeat for each of the eight emails in section 5:

1. In the private window (browser window 2) open **http://localhost:3000/register**.
2. Type the **Email** and the **Password** (`correct-horse-battery`). Leave "Advanced: I already have a crypto wallet" closed and empty: leaving it empty is what makes the app create a wallet for you. (An account with its own wallet address cannot publish or donate.)
3. Click **Create account**. Wait for the page to finish loading before typing; if text is typed twice or the form resets, reload and wait a second longer.
4. **Expect:** you land on your donor workspace (`/dashboard/donor`): a balance of 0 mINR, "Your donations" (empty), and, under "Advanced: account details", a wallet address. The top bar shows who you are signed in as.
5. Click **Sign out** in the top bar before registering the next one.

**Do `live-admin@test.com` in browser window 1** (normal window) so it is ready for later. Register the other seven in the private window.

### Step 2. Make `live-admin@test.com` the admin (cost: 0 POL)

There is deliberately no button for this. In **Terminal B**:

```bash
cd /c/Users/Rochan/Desktop/Coding/Projects/vera-mvp
pnpm --filter ./apps/web admin:promote live-admin@test.com
```

**Expect:** it prints that the account is now an admin. (If it says "Database not found" the app has never been opened; if it says "No account found", register that email first.) Then in browser window 1, reload or sign in as `live-admin@test.com`: you land on **/dashboard/admin**, the admin console. The role is read from the database on every request, so an already-open session works too.

### Step 3. The organizer applies, the admin approves (cost: small, one on-chain approval)

**3a. Apply.** In the private window, sign in as `live-org@test.com`.
1. On your donor workspace follow the link to become an organizer (it goes to **/dashboard/organizer**).
2. Fill in: **Legal name** (e.g. `Test Relief Trust`), **Registration number** (e.g. `REG-2026-001`), **Jurisdiction** (e.g. `India`), and **Document**: choose any JPEG, PNG, WEBP, GIF or PDF file up to 8 MB (the app fingerprints it in your browser and uploads it so the admin can open it).
3. Click **Submit for verification**. **Expect:** status "pending".
4. Click **Sign out**.

**3b. Approve.** In browser window 1, signed in as `live-admin@test.com` on **/dashboard/admin**:
1. Find the application from `Test Relief Trust` (pending applications are listed first). Open its document to check it loads.
2. Click **Approve**.
3. **Expect:** the application shows as verified with **"Recorded on-chain"**. This sends `setOrganizerVerified` to the Factory and costs a small amount of POL. If it says "not configured", `.env.local` is wrong (check section 3 step 2 and restart `pnpm dev`). If the chain step fails, use the retry/sync button on that row.

### Step 4. Give out the attestor and council roles (cost: small per role, five roles)

In browser window 1, as admin on **/dashboard/admin**, scroll to **Attestors and council**:
1. Type `live-att1@test.com`, pick **Attestor** in the dropdown, click **Grant role**.
2. Repeat for `live-att2@test.com` (**Attestor**).
3. Type `live-c1@test.com`, pick **Council member**, click **Grant role**. Repeat for `live-c2@test.com` and `live-c3@test.com`.
4. **Expect:** each row says **"Registered on the blockchain"**. A row that does not has a **Retry sync** button; use it.

Things that must be **refused** here (no POL spent, caught before sending): granting Attestor to `live-org@test.com` or `live-admin@test.com` (conflict of interest).

### Step 5. Create and publish the campaign (cost: about 0.2 POL)

In the private window, sign in as `live-org@test.com`. You land on **/dashboard/campaigns**. Click the button to create a new campaign (**/dashboard/campaigns/new**) and fill in exactly:

| Field | Value |
|---|---|
| Campaign title | `Live test campaign` |
| What is this campaign for? | `Testing the full escrow flow on the real Amoy testnet.` (20+ characters) |
| Category | Community |
| Funding goal (rupees) | `500` |
| Admin cost cap (%) | `10` |
| Campaign runs for (days) | `90` (default) |
| Refund if no progress for (days) | `30` (default) |
| Milestone 1: description | `First tranche: supplies delivered` |
| Milestone 1: Share of the goal (%) | `40` |
| Milestone 1: Confirmations needed | `2` |
| Milestone 2: description | `Second tranche: work completed` |
| Milestone 2: Share of the goal (%) | `60` |
| Milestone 2: Confirmations needed | `2` |

Use **Add milestone** for the second one. The line under the milestones should read **"Total: 100% (ready)"**.

Click **Create campaign**. This saves the campaign and **publishes its escrow to Amoy** in one go; it shows "Publishing, this can take a minute..." and can take a minute or more. **Expect:** the campaign page says it is published, shows its own escrow (vault) address, and the **Milestones** section lists two milestones **without** a yellow "not registered" warning. If the publish failed, the campaign stays as a draft: click **Publish to the blockchain** to retry (nothing is lost). If milestones show the yellow warning, click **Register milestones**.

Try these first as **refusals** (no POL spent, the form or API stops them): a milestone with **1** confirmation; percentages that do not total 100 (e.g. 40 and 50); an admin cap of `50` for Community.

Note the campaign's number in the address bar (`/dashboard/campaigns/<id>`); you need it for the public page and the beneficiary page.

### Step 6. Donate (cost: about 0.03 POL)

Sign out, then in the private window sign in as `live-donor@test.com`.
1. Click **Campaigns** in the top bar, open **Live test campaign**.
2. In **Donate to this campaign**, type `250` and click **Donate 250.00** (the "What you pay" box shows the amount going to the campaign and total; the platform fee is 0 unless configured).
3. **Expect:** a progress view steps through getting practice funds, approving and depositing, and ends at **confirmed** in about 15-60 seconds. Practice mINR is created for you automatically (the app mints it). Keep the page open while it runs; the browser drives each step. If it stays pending, reopen it from **Your donations** on `/dashboard/donor`; nothing is lost and no step repeats.

### Step 7. Milestone 1: attestors, then release (cost: a few hundredths of POL)

1. Sign in as `live-att1@test.com`. You land on **/dashboard/attestor**.
2. Find **First tranche: supplies delivered**. Click **Choose file**, pick any image or text file (stands in for evidence), click **Confirm this milestone is complete**.
3. **Expect:** the card shows `Pending · 1 of 2 confirmations` and lists `live-att1`.
4. Sign out, sign in as `live-att2@test.com`, do the same.
5. **Expect:** `Verified · 2 of 2 confirmations`.
6. Sign out, sign in as `live-org@test.com`, open the campaign from **/dashboard/campaigns**, and click **Release the money** on milestone 1.
7. **Expect:** **Released** (100 mINR, i.e. 40% of the 250 raised, which is not above the 100 mINR auto-release limit, so no council was needed).

Should be **refused**: the same attestor confirming twice; releasing milestone 2 before milestone 1 is released.

### Step 8. Milestone 2: attestors, a refused release (cost: a few hundredths of POL)

1. As `live-att1@test.com` then `live-att2@test.com`, confirm **Second tranche: work completed** exactly as in Step 7.
2. As `live-org@test.com`, click **Release the money** on milestone 2.
3. **Expect: refused.** The message says the payout (150 mINR) is above the automatic limit and needs 3 council approvals. This is correct behaviour; no POL is spent on a refusal caught before sending.

### Step 9. Council approval and the final release (cost: a few hundredths of POL)

1. Sign in as `live-c1@test.com` (you land on **/dashboard/council**). Find the second milestone and click **Approve this release**. **Expect:** "You approved this one." Sign out.
2. Sign in as `live-c2@test.com` and approve the same way.
3. As `live-org@test.com`, click **Release the money** again. **Expect: still refused**, saying it needs 3 approvals and has 2.
4. Sign in as `live-c3@test.com` and approve.
5. As `live-org@test.com`, click **Release the money** once more. **Expect: it succeeds.** Both milestones are now Released (100 + 150 = 250 mINR sent to the organizer's wallet).

### Step 10. Register a beneficiary (cost: about 0.02 POL)

As `live-org@test.com`:
1. Open the campaign in your dashboard and follow the **Beneficiaries** link (**/dashboard/campaigns/<id>/beneficiaries**).
2. Under **Register a beneficiary**, enter an identifying detail such as `Asha Devi, 1990-04-12, Rampur`, fill in **How will they be paid?**, and click **Register beneficiary**. (The text is turned into a fingerprint in your browser; neither the server nor the chain ever sees it.)
3. **Expect:** "registered on the blockchain".
4. Type **the same detail again** and register. **Expect: refused as a duplicate** (enforced by the database, a chain pre-check and the contract).

### Step 11. Record a payout (cost: about 0.03 POL)

As `live-org@test.com`, on the campaign page under a **Released** milestone the **Record the payout to a beneficiary** card appears.
1. Pick the beneficiary, enter `100`, click **Record payout**.
2. **Expect:** it sends an approval and then the payout ("Recording on the blockchain, this can take a minute...") and shows the result.
3. Try a second payout for the same milestone. **Expect: refused ("already paid")**. Try an amount larger than what was released and not yet paid out: **refused before any transaction is sent**.

### Step 12 (optional). More refusals to try

Each should end in a plain-language message with no money moved: grant `live-att1` the Council role while it is an attestor (refused until the attestor role is removed); as the donor open `/dashboard/admin`, `/dashboard/attestor` or `/dashboard/council` (you are sent away); signed out, open any `/dashboard/...` address (you are sent to sign in); double-click a button quickly (only one action happens).

---

## 7. Check the public audit page (free, no sign-in)

Open http://localhost:3000/campaigns in browser window 1 (or any window) and click **Live test campaign**. The page refreshes when read; give it **15-20 seconds** after your last action.

**Expect:**
- **Still held in escrow** `₹0`, **Released to the organizer** `₹250`, **Paid out to beneficiaries** `₹100`, **Released, not yet paid out** `₹150`.
- A **Payouts to beneficiaries** section listing the payout (a fingerprint and a reference, never a name).
- Both milestones show **Released**, with the confirmations and council approvals named.
- The reconciliation badge says the totals **match the blockchain**.
- **Download CSV** works.
- The **End date and refunds** section shows the deadline (90 days out) and the inactivity period. (It says donations are open; closing and refunds are tested on the local chain, see below.)

Cross-check on the chain for free:
- **http://localhost:3000/activity** lists every event with a Polygonscan link per transaction (summary strip, then events by date).
- The vault address on the campaign page opens on https://amoy.polygonscan.com and should show the deposit, releases and the payout.
- ```bash
  cast call 0x8305ECfbd9365efF27efD6f360C36589C006e5eA "disbursedTotal(address)(uint256)" <vault address> --rpc-url "$R"
  ```
  should print `100000000` (100 mINR in units).
- Open **/how-it-works** once (free).

**Expiry and refunds on the real chain:** closing needs the deadline (90 days) or inactivity period (30 days) to actually pass, and a testnet cannot be time-travelled. To exercise close and claim-refund quickly, create a **second** campaign with **Campaign runs for = 1** day or the minimum allowed, wait it out, then click **Close this campaign** and have the donor click the **Claim** button. Otherwise test refunds on the free local chain (`manual_test_local.md`, step 9c), which can move the clock.

---

## 8. Optional: the automated live test (costs POL)

`apps/web/lib/escrow/live-amoy.test.ts` does the whole lifecycle through the real routes in a throwaway in-memory database (it never touches `vera.db`) and creates about nine throwaway wallets whose leftover gas is stranded. About **0.28-0.30 POL** per run at 50 gwei, refuses to start under 1 POL, takes 2-25 minutes. 

**Ask first, and run it in the background with output redirected to a file. Never use a shell timeout and never pipe it through `tail`**: that killed a run mid-way on 2026-09-30 after POL was spent. The exact command is in the test file's header comment. Prefer the free local runs (`manual_test_local.md`, section 8) to prove a code path.

---

## 9. After a live session

1. Stop `pnpm dev` (Ctrl+C in Terminal C). Close the private window.
2. Read the sponsor balance again (section 3 step 3) and compare with your starting figure.
3. **Record the spend and the new balance in `docs/PROGRESS_LOG.md`** (project rule).
4. Do not delete `vera.db*`. Nothing needs clearing, and the accounts you made are reusable next time with the same password.

---

## 10. Troubleshooting

| What you see | What to do |
|---|---|
| Publishing fails or the transaction is "reverted by the contract" | Check `FACTORY_ADDRESS` in `.env.local` is `0xcBA4...2364` (not the old `0x6931...`) and restart `pnpm dev`; then retry **Publish to the blockchain**. |
| Approval, publishing or donating says "not configured" or "switched off" | `FACTORY_OWNER_KEY` or a contract address is missing from `.env.local`. Add it and restart `pnpm dev`. |
| A vault address "already has history" on Polygonscan, or a tx hash is "not found" | `apps/web/.env.development.local` is present and the app is on a local chain. Rename it aside and restart. |
| "Network fees are unusually high" | Gas is above 150 gwei. Wait a few minutes, check `cast gas-price`, retry. |
| A sponsored action fails with a low-balance message | The sponsor wallet is low. Top it up (`docs/mining_instructions.md`), then retry the same action. |
| Publishing says the organizer is not verified on-chain | The approval did not reach the (new) Factory. Admin console, retry/sync on that organizer. |
| A milestone action says "not registered as an attestor/council on the blockchain" | Admin console, **Retry sync** on that person. |
| Milestones show a yellow "not registered" warning | Click **Register milestones** on the organizer's campaign page. |
| The ledger says "data as of block N" and seems behind, or reconciliation says "could not compare" | Wait 15-20 seconds and refresh. Public RPCs can lag or refuse old state; the app never shows a false match. |
| A donation stays PENDING | The browser drives it. Reopen it from **Your donations**; nothing is lost and no step repeats. |
| Amber "Another window signed in as ..." bar | Two windows of one browser profile are signed in as different people. Use a private window for the second person and click **Refresh**. |
| Text typed twice, or a form resets | Wait for the page to finish loading before typing. |
| Old campaigns (#0-#3) have no owner | They were created by accounts that no longer exist in the database. Ignore them, or restore the backup. |
| After switching to the new Factory, old campaigns vanish from the public list | Expected: the indexer follows one Factory. They still exist on-chain. |

## 11. What this test proves that the local one cannot

Behaviour on the real public RPC servers, real gas prices and spikes, and real block times (about 2 seconds). It also costs POL and cannot be reset, so do it rarely and deliberately, after asking.
