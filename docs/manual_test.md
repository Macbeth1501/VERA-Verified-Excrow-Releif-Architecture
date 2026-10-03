# Manual test guide: run and test VERA in your browser, for free

This guide takes you from a clean machine to a fully working copy of VERA in your browser, and then walks through every feature: registration, organizer approval, publishing a campaign, donating, milestone confirmation, council approval, release and the public audit page.

**It costs no Polygon Amoy POL** (and no step in this guide can spend any, as long as `apps/web/.env.development.local` points at `127.0.0.1`; if it is missing, `pnpm dev` silently uses Amoy, where publishing, donating, attesting, releasing, registering beneficiaries and recording payouts all spend sponsor POL). Instead of the public testnet it uses a blockchain that runs on your own computer (Foundry's `anvil`), where test money is free and unlimited. Your Amoy wallet and key are never involved.

All commands are for **Git Bash** on Windows (the same shell the rest of the project docs assume). Replace paths if your project lives somewhere else.

---

## 0. What you will have open

You need **three terminal windows**. Name them in your head:

| Terminal | Purpose | Stays open? |
|---|---|---|
| **A: chain** | Runs the local blockchain (`anvil`) | Yes, the whole time |
| **B: commands** | One-off commands (deploy, promote admin) | Use as needed |
| **C: app** | Runs the website (`pnpm dev`) | Yes, the whole time |

Plus one browser window. Using a private/incognito window is handy for signing in as several people (see section 6).

To open a Git Bash terminal: press the Windows key, type `Git Bash`, press Enter. Or in VS Code use Terminal, New Terminal and pick Git Bash from the dropdown.

---

## 1. Prerequisites (one-time)

Check each of these. If a command is not found, install that tool first.

```bash
node --version      # 20 or newer
pnpm --version      # install with: npm install -g pnpm
forge --version     # Foundry; install from https://book.getfoundry.sh/getting-started/installation
anvil --version     # comes with Foundry
```

You also need Google Chrome, Edge or Firefox.

---

## 2. Get the project ready (one-time)

In **Terminal B**:

```bash
cd /c/Users/Rochan/Desktop/Coding/Projects/vera-mvp
pnpm install
```

This installs everything for the website. It can take a few minutes the first time.

---

## 3. Start the local blockchain

In **Terminal A** (leave it running; do not close it):

```bash
anvil --chain-id 80002 --block-time 1
```

- `--chain-id 80002` makes it look like Polygon Amoy, which is what the app expects.
- `--block-time 1` makes a new block every second. This matters: the app's ledger only trusts blocks that are 2 blocks deep, so without new blocks it would seem to lag.

You will see a list of ten test accounts with private keys. Those keys are public and well known, and the money is fake. **Account (0) is what we use as the platform's "sponsor" wallet.** Its private key is:

```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Important: anvil keeps everything in memory. If you close Terminal A, the chain is gone. You would then need to redo sections 4 and 5 and delete the local database (see "Starting over" at the end).

---

## 4. Deploy the contracts to the local chain

In **Terminal B**, go to the contracts folder and deploy the contracts in this exact order. Do not skip or reorder, because later ones take earlier addresses as constructor arguments.

```bash
cd /c/Users/Rochan/Desktop/Coding/Projects/vera-mvp/contracts
R=http://127.0.0.1:8545
K=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 1. The mock rupee token
forge create src/MockINR.sol:MockINR --rpc-url $R --private-key $K --broadcast

# 2. The milestone manager (auto-release limit 100 mINR, council needs 3 approvals)
forge create src/MilestoneManager.sol:MilestoneManager --rpc-url $R --private-key $K --broadcast --constructor-args 100000000 3

# 3. The campaign factory (takes the token address from step 1)
forge create src/CampaignFactory.sol:CampaignFactory --rpc-url $R --private-key $K --broadcast --constructor-args 0x5FbDB2315678afecb367f032d93F642f64180aa3

# 4. The beneficiary registry (no constructor args)
forge create src/BeneficiaryRegistry.sol:BeneficiaryRegistry --rpc-url $R --private-key $K --broadcast

# 5. Disbursement (token, manager, registry from steps 1, 2, 4; needed for the payout part of the walkthrough)
forge create src/Disbursement.sol:Disbursement --rpc-url $R --private-key $K --broadcast --constructor-args 0x5FbDB2315678afecb367f032d93F642f64180aa3 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
```

**`--constructor-args` must be the last option on the line** (it accepts any number of values, so anything after it is swallowed as an argument and the deploy fails with "Constructor argument count mismatch"). If a deploy fails or you deploy out of order, the addresses below shift: stop anvil, start it again and redo this section from the top.

Each command prints a line `Deployed to: 0x...`. On a **fresh** anvil, deploying in exactly this order gives these addresses (verified 2026-10-03):

| Contract | Address |
|---|---|
| MockINR | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| MilestoneManager | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| CampaignFactory | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| BeneficiaryRegistry | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` |
| Disbursement | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` |

If any of yours differ, use the ones printed on your screen everywhere below (including the registry address in command 5). You can skip steps 4-5 (and the matching env vars in section 5) if you only need the escrow part (attestation, council, release), not beneficiaries or payouts.

Now tell the factory which manager to use (every campaign vault binds to it permanently, so this must be done before any campaign is published):

```bash
cast send 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 "setMilestoneManager(address)" 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 --rpc-url $R --private-key $K
```

Check it worked (both lines should print the addresses from the table):

```bash
cast call 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 "milestoneManager()(address)" --rpc-url $R
cast call 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 "mockToken()(address)" --rpc-url $R
```

---

## 5. Point the website at the local chain

The website reads its settings from `apps/web/.env.local`. To avoid touching your real settings, we create a separate file, `.env.development.local`, which takes priority while you run `pnpm dev`. It is git-ignored.

First generate the two secrets the app needs (run each, copy the output):

```bash
cd /c/Users/Rochan/Desktop/Coding/Projects/vera-mvp/apps/web
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # use as AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # use as WALLET_ENCRYPTION_KEY
```

(If you already have an `apps/web/.env.local` with these two values, you may reuse them. Wallet keys already in an existing database were encrypted with the old key, so with a fresh database any value works.)

Create `apps/web/.env.development.local` with this content (paste your two secrets in):

```
# LOCAL-CHAIN TESTING ONLY. Overrides .env.local in `pnpm dev`. Delete this file to return to Amoy.
DATABASE_URL=./data/local-chain.db
AUTH_SECRET=<paste the first value>
WALLET_ENCRYPTION_KEY=<paste the second value>
RPC_URL=http://127.0.0.1:8545
MOCK_INR_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
FACTORY_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
MILESTONE_MANAGER_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
INDEXER_START_BLOCK=0
MANAGER_START_BLOCK=0
# Only if you deployed steps 4-5 above (beneficiaries / payouts); these are the fresh-anvil addresses:
BENEFICIARY_REGISTRY_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
REGISTRY_START_BLOCK=0
DISBURSEMENT_ADDRESS=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
DISBURSEMENT_START_BLOCK=0
# anvil account 0: a publicly known dev key with fake money
FACTORY_OWNER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

What the important lines mean:

- `DATABASE_URL` is a separate local database, so this testing never mixes with your Amoy data.
- `FACTORY_OWNER_KEY` switches on the features that send transactions (publishing, donating, attesting, releasing). Here it is the anvil dev key, so it spends fake money only.
- `INDEXER_START_BLOCK=0` and `MANAGER_START_BLOCK=0` (and `REGISTRY_START_BLOCK`/`DISBURSEMENT_START_BLOCK` if set) make the public ledger read the local chain from the beginning.

**This file has bitten a real Amoy session before:** it takes priority over `.env.local` in `pnpm dev`, silently, with no on-screen warning. Leaving it in place after a local-chain session (even just forgetting it exists) has previously sent what looked like real Amoy activity — a published campaign, a donation — to a local anvil chain instead, with no error. If you ever see a vault address that "already has history" on `amoy.polygonscan.com`, or a donation transaction hash it says it cannot find, check for this file first before anything else. See section 11.

---

## 6. Start the website

Make sure **no other `pnpm dev` is running** (an old one on port 3000 has the old settings and Next.js allows only one per project). If one is, press Ctrl+C in its terminal.

In **Terminal C**:

```bash
cd /c/Users/Rochan/Desktop/Coding/Projects/vera-mvp
pnpm dev
```

Wait for `Ready`, then open **http://localhost:3000** in your browser. The database file is created and migrated automatically on the first request.

**Signing in as different people:** the site keeps you signed in with a cookie shared by every window of the same browser profile, so one browser profile is one person (if you sign in as someone else in a second window, the first window now shows an amber "Another window signed in as ..." warning with a Refresh button). After signing in you land on your role's own workspace (`/dashboard` redirects donor, organizer, attestor, council and admin to their pages), and the top bar shows who you are and the links for your role. To test several roles, use separate browser profiles or incognito windows (for example one normal window for the admin and one incognito window for everyone else, signing out and in between people). Signing out is in the top bar.

---

## 7. The walkthrough

You will create eight accounts. Use the password `correct-horse-battery` for all of them (it must be at least 12 characters).

| Email | Role in this test |
|---|---|
| `admin@test.com` | Admin (approves organizers, assigns roles) |
| `org@test.com` | Campaign organizer |
| `donor@test.com` | Donor |
| `att1@test.com`, `att2@test.com` | Attestors (confirm milestones) |
| `c1@test.com`, `c2@test.com`, `c3@test.com` | Council members (approve large payouts) |

### Step 1: Register the accounts
1. Open http://localhost:3000/register.
2. Register each of the eight emails above. Leave any "own wallet" option empty: each account gets a wallet created for it automatically.
3. Expected: after registering you land on your own workspace. A new donor lands on `/dashboard/donor`, which shows a balance of 0 mINR, "Your donations" and, under "Advanced: account details", a wallet address. The top bar shows who you are signed in as.

### Step 2: Make `admin@test.com` an admin
There is deliberately no button for this. In **Terminal B**:

```bash
cd /c/Users/Rochan/Desktop/Coding/Projects/vera-mvp
DATABASE_URL=./data/local-chain.db pnpm --filter ./apps/web admin:promote admin@test.com
```

Expected: it prints that the account is now an admin. Sign in as `admin@test.com` and confirm you land on `/dashboard/admin`, the admin console. (The role is read from the database on every request, so an existing session also works.)

### Step 3: Approve the organizer
1. Sign in as `org@test.com`, open the donor workspace (`/dashboard/donor`) and follow the link to become an organizer (`/dashboard/organizer`).
2. Fill in a legal name, registration number and jurisdiction, and attach a JPEG/PNG/WEBP/GIF/PDF file up to 8 MB (it is fingerprinted in your browser and uploaded, so an admin can open it before approving). Submit. The status should be "pending".
3. Sign in as `admin@test.com`, open the admin console, and click **Approve** on the application.
4. Expected: the application shows as verified with "Recorded on-chain". (If it says "not configured", the website is not using the settings from section 5; check the file name and restart `pnpm dev`.)

### Step 4: Give out the attestor and council roles
1. Still as admin, scroll to **Attestors and council** in the admin console.
2. Enter `att1@test.com`, choose Attestor, click Grant role. Repeat for `att2@test.com`.
3. Enter `c1@test.com`, choose Council member, click Grant role. Repeat for `c2@test.com` and `c3@test.com`.
4. Expected: each row says "Registered on the blockchain".

### Step 5: Create and publish a campaign
1. Sign in as `org@test.com` and open the dashboard to create a campaign.
2. Title: `Local test campaign`. Summary: any sentence of 20+ characters. Category: Community. Goal: `500` (rupees). Admin cost cap: `10`.
3. Add two milestones:
   - "First tranche: supplies delivered", **40**%, **2** confirmations
   - "Second tranche: work completed", **60**%, **2** confirmations
4. Save, then click **Publish to the blockchain**. This can take up to a minute the first time.
5. Expected: the page says the campaign is published with its own escrow address, and the Milestones section lists two milestones with no yellow "not registered" warning.

Things to try that should be **refused**:
- A milestone needing only **1** confirmation.
- Milestone percentages that do not total 100 (for example 40 and 50).
- An admin cost cap of 50 for this category.

### Step 6: Donate
1. Sign in as `donor@test.com`, open **Campaigns** and click the campaign.
2. Enter `250` and donate.
3. Expected: a progress view moves through several steps (getting practice funds, approving, depositing) and ends at "confirmed" within about 15 seconds. Practice money is created for you automatically.

### Step 7: Milestone 1 (below the limit: attestors only)
1. Sign in as `att1@test.com`. You land on the attestor console (`/dashboard/attestor`).
2. Find "First tranche". Click "Choose file", pick any file (any image or text file), then click **Confirm this milestone is complete**.
3. Expected: the card shows `Pending · 1 of 2 confirmations`, and shows `att1` under the list of confirmations.
4. Sign in as `att2@test.com` and do the same.
5. Expected: the card now says `Verified · 2 of 2 confirmations`.
6. Sign in as `org@test.com`, open the campaign in your dashboard and click **Release the money** on the first milestone.
7. Expected: it says Released. This payout is 100 mINR, which is not above the 100 limit, so no council was needed.

### Step 8: Milestone 2 (above the limit: needs the council)
1. As `att1@test.com` then `att2@test.com`, confirm "Second tranche" (same as step 7).
2. As `org@test.com`, click **Release the money** on the second milestone.
   **Expected: refused.** The message says the payout is above the automatic limit and needs 3 council approvals.
3. Sign in as `c1@test.com` (you land on `/dashboard/council`), find the milestone and click **Approve this release**. Then do the same as `c2@test.com`.
4. As `org@test.com`, try Release again.
   **Expected: still refused**, now saying it needs 3 approvals and has 2.
5. Sign in as `c3@test.com` and approve.
6. As `org@test.com`, click Release once more.
   **Expected: it succeeds.** Both milestones are now Released.

### Step 8b: Register a beneficiary and record a payout
Needs the BeneficiaryRegistry and Disbursement contracts from section 4 (commands 4-5) and their env vars. Do it once both milestones are Released.
1. As `org@test.com`, open the campaign in your dashboard and follow the link to **Beneficiaries** (`/dashboard/campaigns/<id>/beneficiaries`).
2. Under **Register a beneficiary**, enter an identifying detail (for example `Asha Devi, 1990-04-12, Rampur`), fill in "How will they be paid?" and click **Register beneficiary**. Expected: registered on the blockchain. The detail is scrambled into a fingerprint in your browser; the server and the chain never see the text.
3. Register the **same** detail again. Expected: refused as a duplicate (the database, a chain pre-check and the contract itself all enforce it).
4. Back on the campaign page, under a Released milestone, the **Record payout** card appears. Pick the beneficiary, enter `100` and click **Record payout**. Expected: it sends an approval and then the payout (up to a minute) and shows the result.
5. Try to record a payout for the same milestone again. Expected: refused ("already paid"). Try an amount above what has been released and not yet paid out. Expected: refused before any transaction is sent.

### Step 9: Check the public audit page
Open `http://localhost:3000/campaigns` and click the campaign (no sign-in needed). Wait up to about 15 seconds for it to catch up, then check:
- "Still held in escrow" is `₹0`, and "Released to the organizer" shows `₹250`. "Paid out to beneficiaries" stays `₹0` until you record a payout (released means moved to the organizer; paid out means recorded to a registered beneficiary).
- After step 8b, "Paid out to beneficiaries" shows `₹100`, a **Payouts to beneficiaries** section lists the payout (fingerprint and reference, never a name), and the reconciliation badge still says the totals match.
- "Released, not yet paid out" shows the part of the release the organizer has not yet recorded as payouts (`₹250` minus whatever you have paid out).
- Both milestones show Released: the released amount as the large figure, the four-stage track, and one sentence naming the confirmations, the council approvals and how much was paid out to a beneficiary.
- The reconciliation seal sits beside "Where the money is".
- The reconciliation badge says the totals match the blockchain.
- "Download CSV" works and includes the attestations, approvals and releases.

### Step 9b: Check the public explanation and activity pages
- Open `http://localhost:3000/how-it-works` (also linked from the top bar and the footer). Expected: the four-stage rail, who does what, a glossary and the contracts in plain words.
- Open `http://localhost:3000/activity`. Expected: a summary strip (Locked, Confirmed, Released, Paid out), events grouped under date headings, each with a transaction link and a "Contract and block" disclosure.
- Press Tab once on any page. Expected: a "Skip to main content" link appears; Enter moves focus to the page content.

### Step 10: Try to break it
Each of these should end in a plain-language refusal, and no money should move:
- The same attestor confirming a milestone twice.
- As admin, granting `org@test.com` (the organizer) or `admin@test.com` the Attestor role. Expected: refused, because organizers and admins cannot hold that role (conflict of interest).
- Granting `att1@test.com` the Council role while they are an attestor. Expected: refused until the attestor role is removed.
- Trying to release milestone 2 before milestone 1 has been released (do this on a second campaign).
- Double-clicking a button quickly.
- Signing in as a donor and opening `http://localhost:3000/dashboard/admin`, `/dashboard/attestor` or `/dashboard/council`. Expected: you are sent away.
- Signing out and opening any of those dashboard addresses. Expected: you are sent to sign in.

---

## 8. Optional: run the automated end-to-end test against the local chain

This does the whole flow above automatically, using the real routes and the local chain, and then checks balances directly from the chain. In **Terminal B** (with anvil still running, and stop `pnpm dev` first if you want a clean run):

```bash
cd /c/Users/Rochan/Desktop/Coding/Projects/vera-mvp/apps/web
LIVE_AMOY=1 \
FACTORY_OWNER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
RPC_URL=http://127.0.0.1:8545 \
MOCK_INR_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3 \
FACTORY_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 \
MILESTONE_MANAGER_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
INDEXER_START_BLOCK=0 MANAGER_START_BLOCK=0 \
npx vitest run lib/escrow/live-amoy.test.ts
```

Expected: `1 passed` (about 2.5 minutes; passed 2026-10-03). If `DISBURSEMENT_ADDRESS` and the registry are also in your environment this test additionally records a 30 mINR payout, which matters for the next test (see the warning below). **Never run this with your Amoy settings**: against Amoy it costs about 0.3-0.5 POL a run and takes 10-15 minutes (if it is ever run on Amoy, do it in the background with output redirected to a file, not with a shell timeout or a pipe; it was run that way successfully on 2026-09-30). The project rule is to spend POL only when strictly necessary.

There is a second one, `lib/disbursement/live-local.test.ts`, covering beneficiary registration and a payout end to end (needs all five contracts from section 4, including Disbursement):

```bash
LIVE_LOCAL=1 \
FACTORY_OWNER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
RPC_URL=http://127.0.0.1:8545 \
MOCK_INR_ADDRESS=<step 1 address> FACTORY_ADDRESS=<step 3 address> \
MILESTONE_MANAGER_ADDRESS=<step 2 address> BENEFICIARY_REGISTRY_ADDRESS=<step 4 address> \
DISBURSEMENT_ADDRESS=<step 5 address> \
npx vitest run lib/disbursement/live-local.test.ts
```

Expected: `1 passed` (takes about 85 seconds). **Run it against a Disbursement contract that has no earlier payouts**: it asserts the contract holds exactly 30 mINR, so after the previous test (or any manual payout) it fails with `expected 60000000n to be 30000000n`. Either run it on a fresh anvil, or deploy a second Disbursement (command 5 in section 4) and pass that address as `DISBURSEMENT_ADDRESS`. It refuses to run against anything but `127.0.0.1`/`localhost`, so it can never spend Amoy POL either.

---

## 9. The free automated checks (no chain needed)

From the repository root:

```bash
pnpm test                      # contract tests: 73 passing (fuzz at 10,000 runs)
pnpm test:web                  # web tests against simulated chains: 367 passing, 2 skipped (the 2 are the opt-in live tests)
cd apps/web && npx tsc --noEmit && npx eslint . && cd ../..    # should print nothing
pnpm build                     # production build; stop pnpm dev first
```

---

## 10. Starting over

Anvil forgets everything when it stops. If you close Terminal A, or want a completely clean run:

1. Press Ctrl+C in Terminal C (the website) and Terminal A (anvil).
2. Delete the local database: `rm -f apps/web/data/local-chain.db*`
3. Start anvil again (section 3), redeploy (section 4), start the website (section 6).

To clear **everything** after a session: stop anvil and `pnpm dev`, delete `apps/web/data/local-chain.db*` and delete `apps/web/.env.development.local` (section 11). The Amoy database is a different file, `apps/web/data/vera.db`; do not delete it unless you mean to, because it holds the generated wallets (encrypted keys) of the real Amoy organizers and donors.

If you skip step 2 after restarting anvil, the website will show data from a chain that no longer exists and things will look broken.

## 11. Going back to normal (the real Amoy testnet)

1. Press Ctrl+C in Terminals A and C.
2. **Delete or rename `apps/web/.env.development.local`** (e.g. `mv apps/web/.env.development.local apps/web/.env.development.local.bak` if you want to keep it for next time). Do this as soon as you're done with a local-chain session, not "eventually" — it is easy to forget it exists, and it silently overrides `.env.local` with no warning on screen. This exact thing happened once: a campaign and a donation were made believing they were on real Amoy, while `pnpm dev` was actually still pointed at a long-gone local anvil chain.
3. Start `pnpm dev` again. It now reads `apps/web/.env.local` (Amoy). If you're not sure which one it's using, check the admin console or a fresh publish/donation against `cast balance`/`amoy.polygonscan.com` — Amoy activity should show up there within seconds.

On real Amoy, `.env.local` now also carries `DISBURSEMENT_ADDRESS` (`0x8305ECfbd9365efF27efD6f360C36589C006e5eA`) and `DISBURSEMENT_START_BLOCK` (`48925371`), so the payout card and public Payouts section are switched on there too. Remember: on Amoy, anything that sends a transaction needs POL in the sponsor wallet and `FACTORY_OWNER_KEY` in `.env.local`. See `docs/mining_instructions.md`.

## 12. Troubleshooting

| What you see | What to do |
|---|---|
| Admin approval says "not configured" | The website is not reading `.env.development.local`. Check the file is in `apps/web/`, then restart `pnpm dev`. |
| "Port 3000 in use" or "another dev server is running" | An old `pnpm dev` is still running. Close it (Ctrl+C in its terminal) and start again. |
| Publishing fails with a connection error | Anvil is not running, or `RPC_URL` is wrong. Check Terminal A is alive and the file says `http://127.0.0.1:8545`. |
| Publishing says the organizer is not verified on-chain | The approval did not reach the chain. Open the admin console and use the retry/sync button. |
| The campaign page shows old or missing data after restarting anvil | Delete `apps/web/data/local-chain.db*` and restart (section 10). |
| Milestones show a yellow "not registered" warning | Click **Register milestones** on the campaign page in the organizer dashboard. |
| A milestone action says "not registered as an attestor/council on the blockchain" | The role was saved but not synced. In the admin console, click **Retry sync** on that person. |
| "Network fees are unusually high" | Only happens on real Amoy when gas spikes. Wait a few minutes. It does not occur on anvil. |
| The ledger says "data as of block N" and seems behind | Wait about 15 seconds and refresh; it needs 2 new blocks (anvil makes one per second). |
| Weird text is typed twice or a form resets | Wait for the page to finish loading before typing; the form hydrates a moment after the page appears. |

## Which steps would cost POL on Amoy

Nothing above does, because everything runs on anvil. Pointed at real Amoy instead, these would each spend POL from the sponsor wallet: approving an organizer, granting attestor/council roles (section 7, steps 3-4), publishing a campaign (step 5, includes a gas top-up for the organizer), a donor's first donation (step 6, about 0.03 POL), attestations, council approvals and releases (steps 7-8), and beneficiary registration and payouts (step 8b). Running `live-amoy.test.ts` on Amoy costs about 0.3 POL per run. Reads, the public pages and all the free checks in section 9 cost nothing. Do not point this walkthrough at Amoy casually; see the "Testnet POL rule" in `CLAUDE.md`.

## 13. What this test does not prove

- How the app behaves on the real public Amoy RPC servers (slower, sometimes flaky).
- Real gas prices and spikes (anvil's gas is nearly free).
- Timing with real block times (Amoy is about 2 seconds a block).

Those can only be checked on the real testnet, which costs POL. Do that rarely and deliberately, after asking; see the "Testnet POL rule" in `CLAUDE.md`.
