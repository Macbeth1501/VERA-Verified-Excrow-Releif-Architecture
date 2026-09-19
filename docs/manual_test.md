# Manual test guide: run and test VERA in your browser, for free

This guide takes you from a clean machine to a fully working copy of VERA in your browser, and then walks through every feature: registration, organizer approval, publishing a campaign, donating, milestone confirmation, council approval, release and the public audit page.

**It costs no Polygon Amoy POL.** Instead of the public testnet it uses a blockchain that runs on your own computer (Foundry's `anvil`), where test money is free and unlimited. Your Amoy wallet and key are never involved.

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

In **Terminal B**, go to the contracts folder and deploy three contracts in this exact order. Do not skip or reorder, because the addresses below depend on the order.

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
```

Each command prints a line `Deployed to: 0x...`. On a fresh anvil they will be exactly:

| Contract | Address |
|---|---|
| MockINR | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| MilestoneManager | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| CampaignFactory | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |

If any of yours differ, use the ones printed on your screen everywhere below, and use the real MockINR address in command 3.

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
# anvil account 0: a publicly known dev key with fake money
FACTORY_OWNER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

What the important lines mean:

- `DATABASE_URL` is a separate local database, so this testing never mixes with your Amoy data.
- `FACTORY_OWNER_KEY` switches on the features that send transactions (publishing, donating, attesting, releasing). Here it is the anvil dev key, so it spends fake money only.
- `INDEXER_START_BLOCK=0` and `MANAGER_START_BLOCK=0` make the public ledger read the local chain from the beginning.

---

## 6. Start the website

Make sure **no other `pnpm dev` is running** (an old one on port 3000 has the old settings and Next.js allows only one per project). If one is, press Ctrl+C in its terminal.

In **Terminal C**:

```bash
cd /c/Users/Rochan/Desktop/Coding/Projects/vera-mvp
pnpm dev
```

Wait for `Ready`, then open **http://localhost:3000** in your browser. The database file is created and migrated automatically on the first request.

**Signing in as different people:** the site keeps you signed in with a cookie, so one browser window is one person. To test several roles, use separate browser profiles or incognito windows (for example one normal window for the admin and one incognito window for everyone else, signing out and in between people). Signing out is in the account page.

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
3. Expected: after registering you land on your account page showing a balance of 0 mINR and, under "Advanced: account details", a wallet address.

### Step 2: Make `admin@test.com` an admin
There is deliberately no button for this. In **Terminal B**:

```bash
cd /c/Users/Rochan/Desktop/Coding/Projects/vera-mvp
DATABASE_URL=./data/local-chain.db pnpm --filter ./apps/web admin:promote admin@test.com
```

Expected: it prints that the account is now an admin. Sign in as `admin@test.com` and confirm the account page offers "Open the admin console".

### Step 3: Approve the organizer
1. Sign in as `org@test.com`, open the account page and choose "Want to run a campaign? Become an organizer".
2. Fill in a legal name, registration number and jurisdiction, and attach any file (it is only fingerprinted in your browser; the file is not uploaded). Submit. The status should be "pending".
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
1. Sign in as `att1@test.com`. The account page offers "Open the attestor console".
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
3. Sign in as `c1@test.com`, open the council console, find the milestone and click **Approve this release**. Then do the same as `c2@test.com`.
4. As `org@test.com`, try Release again.
   **Expected: still refused**, now saying it needs 3 approvals and has 2.
5. Sign in as `c3@test.com` and approve.
6. As `org@test.com`, click Release once more.
   **Expected: it succeeds.** Both milestones are now Released.

### Step 9: Check the public audit page
Open `http://localhost:3000/campaigns` and click the campaign (no sign-in needed). Wait up to about 15 seconds for it to catch up, then check:
- "Held in escrow" is `₹0` and there is a line saying `₹250` has already been paid out.
- Both milestones show Released, with their confirmations, council approvals and paid-out amounts.
- The reconciliation badge says the totals match the blockchain.
- "Download CSV" works and includes the attestations, approvals and releases.

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

Expected: `1 passed`. **Never run this with your Amoy settings**: against Amoy it costs about 0.5 POL a run. The project rule is to spend POL only when strictly necessary.

---

## 9. The free automated checks (no chain needed)

From the repository root:

```bash
pnpm test                      # contract tests: 45 passing (fuzz at 10,000 runs)
pnpm test:web                  # web tests against simulated chains: about 215 passing, 1 skipped
cd apps/web && npx tsc --noEmit && npx eslint . && cd ../..    # should print nothing
pnpm build                     # production build; stop pnpm dev first
```

---

## 10. Starting over

Anvil forgets everything when it stops. If you close Terminal A, or want a completely clean run:

1. Press Ctrl+C in Terminal C (the website) and Terminal A (anvil).
2. Delete the local database: `rm -f apps/web/data/local-chain.db*`
3. Start anvil again (section 3), redeploy (section 4), start the website (section 6).

If you skip step 2 after restarting anvil, the website will show data from a chain that no longer exists and things will look broken.

## 11. Going back to normal (the real Amoy testnet)

1. Press Ctrl+C in Terminals A and C.
2. Delete `apps/web/.env.development.local`.
3. Start `pnpm dev` again. It now reads `apps/web/.env.local` (Amoy).

Remember: on Amoy, anything that sends a transaction needs POL in the sponsor wallet and `FACTORY_OWNER_KEY` in `.env.local`. See `docs/mining_instructions.md`.

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

## 13. What this test does not prove

- How the app behaves on the real public Amoy RPC servers (slower, sometimes flaky).
- Real gas prices and spikes (anvil's gas is nearly free).
- Timing with real block times (Amoy is about 2 seconds a block).

Those can only be checked on the real testnet, which costs POL. Do that rarely and deliberately, after asking; see the "Testnet POL rule" in `CLAUDE.md`.
