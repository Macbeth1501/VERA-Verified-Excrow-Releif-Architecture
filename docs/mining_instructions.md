# Mining POL on Polygon Amoy — Step-by-Step Guide

How to collect testnet POL from the Polygon faucet using throwaway wallets, then sweep it into the VERA main wallet. Everything here is testnet: the tokens have no real value.

All commands are **Git Bash** (Unix syntax) and use Foundry's `cast`, which is already installed (v1.7.1).

---

## 0. Main wallet details (the destination)

| Item | Value |
|---|---|
| Purpose | VERA deployer wallet; the **owner** of the CampaignFactory (verifies organizers, sets the milestone manager); and the app's **gas sponsor**: when `FACTORY_OWNER_KEY` is set in `apps/web/.env.local`, the web app pays the gas for organizer and donor wallets from this wallet, so every campaign published and every first donation drains it |
| Address | `0xb2Ab1471d98909237B3F3828E7422182584E11E3` |
| Network | Polygon Amoy testnet |
| Chain ID | `80002` |
| Currency | POL (used to pay gas) |
| Private key | Stored in `contracts/.env` as `DEPLOYER_PRIVATE_KEY`. Never paste it into chat, docs or commits. |
| Explorer page | https://amoy.polygonscan.com/address/0xb2Ab1471d98909237B3F3828E7422182584E11E3 |
| Balance on 2026-09-19 | **about 0.01 POL** (was 1.90 before deploying MilestoneManager at a gas spike, 1.41 POL, and running live tests). It needs a top-up before anything on-chain will work again. |

Related deployed contracts (for reference):

| Contract | Address |
|---|---|
| MockINR | `0x9b6f00a1ce627a3e0d2da601253704084d8fc52c` |
| MilestoneManager | `0xe6d7222dDe3eE4b9688269427631aDF49229e747` |
| CampaignFactory | `0x6931E776da5db1D9e5890407FE268705D70740bD` |

Only the **address** is ever needed to receive tokens. You never need the main wallet's private key for this guide except when you later spend from it (deployments), and that already lives in `contracts/.env`.

---

## 1. One-time setup

### 1.1 Network settings (RPC URL, chain ID, etc.)

| Setting | Value |
|---|---|
| Network name | Polygon Amoy |
| Chain ID | `80002` |
| Currency symbol | `POL` |
| Public RPC (official) | `https://rpc-amoy.polygon.technology` (has been **unreachable from the dev machine**; try it, but do not rely on it) |
| Public RPCs that work | `https://polygon-amoy.drpc.org`, `https://polygon-amoy-bor-rpc.publicnode.com`, `https://polygon-amoy.gateway.tenderly.co` |
| Block explorer | `https://amoy.polygonscan.com` |

Public RPCs are free but rate-limited and occasionally down (dRPC sometimes returns a transient 500, and its free tier times out on wide log queries). If one fails or times out, switch to another. The web app itself takes a comma-separated `RPC_URL` and falls back in order. For heavier use, a free account on a provider (Alchemy, Infura, QuickNode, dRPC) gives a private URL with a key in it. **Treat any URL containing a key as a secret.**

### 1.2 Set the RPC for your terminal session

Foundry's `cast` reads `ETH_RPC_URL`, so you do not need `--rpc-url` on every command:

```bash
export ETH_RPC_URL="https://polygon-amoy-bor-rpc.publicnode.com"
export MAIN=0xb2Ab1471d98909237B3F3828E7422182584E11E3
```

Variables last only for the current terminal window, so run these again in each new one.

Sanity check that you are on the right chain:

```bash
cast chain-id          # must print 80002
cast block-number      # should print a large, increasing number
```

If `chain-id` prints anything else, the URL points at a different network. Stop and fix it.

### 1.3 The project's own RPC setting (for contract work)

Contract scripts read `RPC_URL` from `contracts/.env`:

```
RPC_URL=<your rpc url>
DEPLOYER_PRIVATE_KEY=<main wallet key>
```

That file is gitignored. To change the RPC the project uses, edit `RPC_URL` there. You do **not** need to touch it for the mining steps below.

### 1.4 (Optional) Add Amoy to MetaMask

Settings, Networks, Add network manually, then enter the table from 1.1. Useful for viewing balances in a UI. Not required.

### 1.5 Make a safe folder for temp-wallet keys

Temp wallets have private keys too. Keep them **outside the repo** so they can never be committed:

```bash
mkdir -p ~/vera-temp-wallets
```

That is `C:\Users\Rochan\vera-temp-wallets` on Windows. Never put it inside `vera-mvp`.

---

## 2. Daily loop (repeat each day)

Summary: create a temp wallet, claim from the faucet into it, check it arrived, sweep it to the main wallet, check the main wallet, discard the temp wallet.

### Step 1 — Create a temp wallet

```bash
cast wallet new
```

Output looks like:

```
Successfully created new keypair.
Address:     0x....
Private key: 0x....
```

Save both lines to a dated file **outside the repo** (until the sweep is done and confirmed):

```bash
cat > ~/vera-temp-wallets/wallet-$(date +%F)-1.txt <<'EOF'
Address:     <paste address>
Private key: <paste private key>
EOF
```

To make several at once (if you will claim more than once per day):

```bash
for i in 1 2 3; do echo "--- wallet $i ---"; cast wallet new; done
```

### Step 2 — Claim POL from the faucet

1. Open https://faucet.polygon.technology/
2. Select the network **Polygon Amoy** and the token **POL**.
3. Paste the temp wallet's **address** (never the private key).
4. Complete any verification the page asks for (captcha or sign-in), then submit.
5. Note the amount and the cooldown the page shows. Both change over time, so trust the page over this guide. Faucets commonly allow one claim per address or account per day.

Claims are usually confirmed within a minute.

**Fair-use note:** faucets exist for developers to test with, and many limit or block people who create many wallets to get around the daily limit. If claims start failing, the faucet may be rate-limiting you or your IP or account. Do not try to evade that; wait out the cooldown or use another faucet (Alchemy, QuickNode, Infura and similar providers each run an Amoy faucet, with their own rules).

### Step 3 — Check the temp wallet balance

```bash
TEMP=0x<temp wallet address>
cast balance $TEMP --ether
```

Repeat every 30 seconds or so until it is above 0. If it is still 0 after 10 minutes, see Troubleshooting.

### Step 4 — Sweep the temp wallet into the main wallet

A transfer costs gas, so you cannot send the whole balance: you send `balance - gas cost`. This snippet does the arithmetic. Paste the temp wallet's private key using `read -s` so it is not shown or saved in shell history:

```bash
read -s -p "Temp wallet private key: " TEMP_PK; echo

TEMP=$(cast wallet address --private-key "$TEMP_PK")
BAL=$(cast balance "$TEMP")                 # in wei
GAS_PRICE=$(cast gas-price)                 # in wei
COST=$(( 21000 * GAS_PRICE * 15 / 10 ))     # 21000 gas for a plain transfer, plus a 50% safety buffer
AMOUNT=$(( BAL - COST ))

echo "Temp:    $TEMP"
echo "Balance: $(cast from-wei $BAL) POL"
echo "Sending: $(cast from-wei $AMOUNT) POL (keeping about $(cast from-wei $COST) POL for gas)"

if [ "$AMOUNT" -gt 0 ]; then
  cast send $MAIN --value $AMOUNT --private-key "$TEMP_PK" --gas-price $GAS_PRICE
else
  echo "Balance too small to cover gas; skip this wallet."
fi

unset TEMP_PK
```

Notes:

- Bash integers are 64-bit, which is fine for balances below about 9 POL. Faucet claims are far below that.
- Amoy enforces a minimum gas tip (about 25 gwei at the time of writing), which `cast gas-price` already includes. If you see "transaction underpriced", raise the price: `--gas-price $(( GAS_PRICE * 2 ))` and recompute `COST` with the same multiplier.
- The leftover dust (the gas buffer) stays in the temp wallet. That is normal.
- `cast send` prints a `transactionHash` and `status 1 (success)` when done.

### Step 5 — Check the main wallet balance

```bash
cast balance $MAIN --ether
```

Also confirm on the explorer (transactions appear within seconds):
https://amoy.polygonscan.com/address/0xb2Ab1471d98909237B3F3828E7422182584E11E3

To confirm one specific transfer:

```bash
cast receipt <transactionHash>      # status should be 1 (success)
```

### Step 6 — Clean up

Once the main wallet shows the increase, the temp wallet's file is no longer needed:

```bash
rm ~/vera-temp-wallets/wallet-$(date +%F)-1.txt
```

Its private key was only ever a way to move the faucet drip. Never reuse a temp wallet's key for anything important.

---

## 3. Optional: log your running total

Keep a small record so you can see progress without asking the chain each time. Example (outside the repo, or in `docs/PROGRESS_LOG.md` if you want it tracked):

```
2026-09-20  +X POL  (wallet 1)   main: Y POL
```

Check the main wallet's current balance any time with `cast balance $MAIN --ether`.

---

## 4. How much POL do you actually need?

The faucet drip is small, but Amoy work is cheap. Measured on 2026-09-19 unless marked as an estimate (gas prices vary):

| Action | Cost to the sponsor wallet |
|---|---|
| Plain POL transfer | a tiny fraction of 1 POL |
| Publish a campaign (top-up of the organizer's wallet, then the vault deploy) | about 0.2 POL at 30-40 gwei (the vault deploy is about 6M gas; an earlier measurement of 0.04 POL was at a lower gas price) |
| A donor's first donation (gas top-up, then mint, approve, deposit) | about 0.03 POL; less afterwards, because leftover POL stays in the donor's wallet |
| Approve an organizer on-chain (one admin transaction) | well under 0.01 POL |
| Deploy a contract like MilestoneManager (2.5M gas) | **about 0.08 POL at 30 gwei, but 1.41 POL when it was deployed during a 570 gwei spike.** Check the gas price first (below). |
| Register milestones, attest, approve (each) | well under 0.01 POL, funded from the actor's own gas estimate |
| A live end-to-end test run (`live-amoy.test.ts`) | about 0.5 POL; the throwaway wallets it creates keep their leftover gas |

The sponsor wallet is drained by real use, not just deployments: each new organizer, donor, attestor and council member spends some, and publishing a campaign is the big one. **Aim for at least 3 POL before a round of testing** (the live test refuses to start under 1 POL). Later steps add more deployments (possibly Disbursement and BeneficiaryRegistry), so a stockpile of 5 to 10 POL is comfortable for the whole MVP. If the sponsor runs dry, an organizer's publish or a donor's donation fails with a clear message and can be retried after you top it up.

---

### Check the gas price before any deployment

Amoy's gas price is normally about 30 gwei but has spiked past 500 gwei, and a deployment sent without a cap simply pays it. Always look first, and cap the price:

```bash
cast gas-price | xargs -I{} cast from-wei {} gwei     # expect about 30-40
# deploy with a ceiling, e.g. forge create ... --gas-price 60gwei --priority-gas-price 30gwei
```

If it is far above 60 gwei, wait a few minutes and check again. The web app enforces the same idea: it refuses sponsored actions above 150 gwei.

---

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| `cast chain-id` is not 80002 | Wrong RPC URL. Re-export `ETH_RPC_URL` from section 1.1. |
| Connection refused, timeout or 429 | Public RPC is down or rate-limited. Switch RPC (1.1) and retry. |
| `localhost:8545` connection refused | `cast`/`forge` did not see an RPC, so `ETH_RPC_URL` is unset in this terminal. Re-run 1.2. |
| Faucet says "already claimed" or "try again later" | Cooldown not over. Wait; do not retry with more wallets from the same account or IP. |
| Faucet succeeded but balance is 0 | Wait a few minutes and re-check. Confirm you pasted the address for the right network (Amoy, not Sepolia or mainnet). Check the address on the explorer. |
| `insufficient funds for gas` on sweep | Balance is too small for the gas buffer. Skip this wallet; leave it for a later top-up. |
| `transaction underpriced` | Raise `--gas-price` (see Step 4 notes). |
| `nonce too low` | Another transaction from that wallet is pending or just confirmed. Wait a minute and retry. |
| Sent to the wrong address | Testnet transfers cannot be reversed. Double-check `$MAIN` with `echo $MAIN` before every sweep. |

---

## 6. Security rules

- Private keys stay out of the repo, chat messages and screenshots. `docs/Main Wallet.txt` (which holds the main key) is gitignored; keep it that way.
- Use `read -s` (as above) instead of typing keys on the command line, so they do not land in shell history.
- The main key is only ever read from `contracts/.env`.
- These are testnet keys with no real value, but the main wallet owns the CampaignFactory, so its key still matters: whoever holds it controls organizer verification.
- If you ever suspect the main key leaked, deploy a fresh Factory from a new wallet rather than trying to keep using the old one.
