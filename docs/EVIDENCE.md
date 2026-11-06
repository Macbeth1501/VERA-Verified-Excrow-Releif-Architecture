# VERA evidence file

> **Update, later on 2026-11-06 (after this evidence pass):** the figures below describe the six contracts that were deployed when it was run (94 Foundry tests in 7 suites). Since then `BeneficiaryRegistryV2` and `DisbursementV2` were added and deployed to Amoy (`0xF1C72cF2D5722a837305424D1966BBBe7F73454a`, `0xba49F68CabB0389091B4767aedfFc90B182f7Bd2`), the Foundry suite is now **122 tests in 9 suites**, and `pnpm test:web` is **497 passed, 6 skipped**. Coverage, gas and Slither numbers below were not re-measured for the two new contracts. Slither over the whole tree now reports 9 informational/low results and no medium or high. The Amoy transactions for the V2 contracts are listed in `PROGRESS_LOG.md` ("C6 part 5").

Collected 2026-11-06 for the UPCON paper (items 3, 4, 19, 21, 25 of the revised action plan). Everything here was produced by read-only commands against Polygon Amoy (chain id 80002) or by local tooling; nothing in this pass spent POL. Raw outputs are in [`docs/evidence/`](evidence/).

Tools: forge 1.7.1, slither 0.11.6, Node 22.14, public Amoy RPCs (`polygon-amoy.drpc.org`, `polygon-amoy-bor-rpc.publicnode.com`, `polygon-amoy.gateway.tenderly.co`). Explorer: [amoy.polygonscan.com](https://amoy.polygonscan.com).

## 1. Contracts, addresses and blocks

| Contract | Address | Block | Deploy transaction |
|---|---|---|---|
| MockINR | [`0x9b6f00a1ce627a3e0d2da601253704084d8fc52c`](https://amoy.polygonscan.com/address/0x9b6f00a1ce627a3e0d2da601253704084d8fc52c) | 43397076 | [`0x5d225bfd…dfe7eb`](https://amoy.polygonscan.com/tx/0x5d225bfd17d3592b7abe769ba96093d3c484eeedcb5542e2a73f2aeb56dfe7eb) |
| MilestoneManager | [`0xe6d7222dDe3eE4b9688269427631aDF49229e747`](https://amoy.polygonscan.com/address/0xe6d7222dDe3eE4b9688269427631aDF49229e747) | 47997230 | not recorded in the repo (see below) |
| BeneficiaryRegistry | [`0xA4BF48D348246f66281B8Ca191F3981e15E5C54D`](https://amoy.polygonscan.com/address/0xA4BF48D348246f66281B8Ca191F3981e15E5C54D) | 48161539 | [`0xccb4b14f…a96ff7`](https://amoy.polygonscan.com/tx/0xccb4b14facd8cfa724bb706dc0ee6abe996eb9b77bd8cd94f45f09856da96ff7) |
| Disbursement | [`0x8305ECfbd9365efF27efD6f360C36589C006e5eA`](https://amoy.polygonscan.com/address/0x8305ECfbd9365efF27efD6f360C36589C006e5eA) | 48925371 | [`0x19ff7250…023925`](https://amoy.polygonscan.com/tx/0x19ff725058065793ec7825a3a14f7d4c6cffaeeb79a2b15caba7cdec38023925) |
| CampaignFactory (current, 6-argument with expiry) | [`0xcBA47322e213107C19Be706e6817629744A42364`](https://amoy.polygonscan.com/address/0xcBA47322e213107C19Be706e6817629744A42364) | 51136547 | [`0xb9b560b2…fd4bca`](https://amoy.polygonscan.com/tx/0xb9b560b22233735be7b590f66fe2988d5903255a315eb04a9cbf69089cfd4bca) |
| CampaignVault (demo vault, created by the Factory) | [`0x6326000CCaEd562fc4787b8D9aF8fDA13479Fa5f`](https://amoy.polygonscan.com/address/0x6326000CCaEd562fc4787b8D9aF8fDA13479Fa5f) | 51138740 | [`0x78852ab6…a93bb1`](https://amoy.polygonscan.com/tx/0x78852ab67f427a8e3584380801c4b3f66ec331960fdedd57d926b6b976a93bb1) |

Notes:
- The `MilestoneManager` deploy transaction hash is not recorded anywhere in the repo (the log only has the block, `47997230`, and the transaction that set it on the old Factory, `0xb54c…8ca9`, whose full hash was not kept). Its deployment can be found on the explorer from the address page.
- The old 4-argument Factory `0x6931E776da5db1D9e5890407FE268705D70740bD` (deployed at block 47969967) was retired on 2026-10-26 and is not part of the results here.
- After deploying the current Factory the owner called `setMilestoneManager` ([`0x54fe0b2f…cf9b97`](https://amoy.polygonscan.com/tx/0x54fe0b2fbab2354c490fbc158ff1632293dfbc5e0b5d0e29def4dd3330cf9b97)).
- The source is **not yet verified on Polygonscan** (needs an API key, see section 9).

## 2. Transactions

### 2.1 Main run: vault `0x6326…Fa5f` (Factory campaign created 2026-10-25 UTC; the progress log calls it the 2026-10-26 walkthrough)

Vault: [`0x6326000CCaEd562fc4787b8D9aF8fDA13479Fa5f`](https://amoy.polygonscan.com/address/0x6326000CCaEd562fc4787b8D9aF8fDA13479Fa5f), 2 milestones (40% and 60% of a 500 mINR goal), 250 mINR donated, 250 mINR released, 200 mINR recorded as paid out.

I read "13 transactions" as the protocol lifecycle below (create, donate, nine milestone transactions, two payouts). If you meant a different 13, the rest of this run's transactions are in 2.2.

| # | Step | Block | Transaction |
|---|---|---|---|
| 1 | createCampaign (Factory) | 51138740 | [`0x78852ab6…a93bb1`](https://amoy.polygonscan.com/tx/0x78852ab67f427a8e3584380801c4b3f66ec331960fdedd57d926b6b976a93bb1) |
| 2 | Donation 250 mINR (`deposit`) | 51139137 | [`0x0a76a89f…bf54ad`](https://amoy.polygonscan.com/tx/0x0a76a89fc7d457ee2ad9e93ba4a13415e85653639ddd722d7f816d11c4bf54ad) |
| 3 | M1 attestation 1 | 51139369 | [`0xd513e96e…35f01e`](https://amoy.polygonscan.com/tx/0xd513e96ef10a64fa34a28a3375bccf471d365baf9052101c20f1a6a64035f01e) |
| 4 | M1 attestation 2 (milestone verified) | 51139437 | [`0x2d24905c…abb5cd`](https://amoy.polygonscan.com/tx/0x2d24905cb9e98a119d675ec270160a7208877b7ab5552e4ca4cda64fc1abb5cd) |
| 5 | M1 release, 100 mINR (auto-release, under the limit) | 51139510 | [`0x3e85c1e9…82844e`](https://amoy.polygonscan.com/tx/0x3e85c1e994e76440dfd6b6347dbd582379438aac37983e4b692ca1c28e82844e) |
| 6 | M2 attestation 1 | 51139616 | [`0x49d11725…c3b168`](https://amoy.polygonscan.com/tx/0x49d117253e08c988f474612d394e298865480d5d769a7ac69ec9212cd1c3b168) |
| 7 | M2 attestation 2 (milestone verified) | 51139664 | [`0xf98f8dcb…7394b7`](https://amoy.polygonscan.com/tx/0xf98f8dcb0e4821e2e190aa373c225896e86333efabd31a514ea74c79707394b7) |
| 8 | M2 council approval 1 | 51139801 | [`0x93836fa0…6a38ee`](https://amoy.polygonscan.com/tx/0x93836fa07e1c22021791a4b88ade1f9a3360bcfcf56d775a831b8fc1606a38ee) |
| 9 | M2 council approval 2 | 51139840 | [`0xe30ed872…0e887a`](https://amoy.polygonscan.com/tx/0xe30ed872eeda0f73a7d1c7444fee0c2f81156c9b95a46d9b575c84987b0e887a) |
| 10 | M2 council approval 3 | 51139887 | [`0xe89f641c…c803d6`](https://amoy.polygonscan.com/tx/0xe89f641cc88787cdd13cba4fe1c7a029745075dd9dee525d8054148ae3c803d6) |
| 11 | M2 release, 150 mINR | 51139917 | [`0x565f49db…32e60c`](https://amoy.polygonscan.com/tx/0x565f49dbefef6debcadaf6a7b6aaf50e1cd3c85e96a5ac8cad0104b2f332e60c) |
| 12 | Payout M1, 100 mINR (`Disbursement.disburse`) | 51140084 | [`0x83eab522…fdf6c9`](https://amoy.polygonscan.com/tx/0x83eab522754ca699ede5454f79438a633435b0933e09cbf01b95c26d35fdf6c9) |
| 13 | Payout M2, 100 mINR | 51140117 | [`0xc2ab82d5…5ecd4d`](https://amoy.polygonscan.com/tx/0xc2ab82d589829fd2bc34a2fb123fbffbade67d0e41f57ac15799232a975ecd4d) |

### 2.2 Other transactions of the same run

| Step | Block | Transaction |
|---|---|---|
| Beneficiary registered (`BeneficiaryRegistry.register`) | 51140019 | [`0xc601a3d4…fff82b`](https://amoy.polygonscan.com/tx/0xc601a3d43451a2e1d9ef488c00e3597a905a8301ca0c96bc3eec41f329fff82b) |
| Milestone 1 defined (`MilestoneManager.defineMilestone`) | 51138744 | [`0x1d26fe8a…78283c`](https://amoy.polygonscan.com/tx/0x1d26fe8ab98f81eb800be604de87e09d48db74a3ed9b5c897818d257c878283c) |
| Milestone 2 defined | 51138747 | [`0x15d065ef…74a40d`](https://amoy.polygonscan.com/tx/0x15d065ef32f702f1a42a976affb2fed9bc28a5dd149d6f3a45e822722474a40d) |
| Organizer verified (`setOrganizerVerified`, Factory) | n/a | [`0xfc04b587…295bc4`](https://amoy.polygonscan.com/tx/0xfc04b587020ad9e1bd2f2190b6d87a890aa7f28274b42a4519d1ec2f63295bc4) |
| Attestor role 1 (`setAttestor`) | n/a | [`0xa8d71d7e…910ec2`](https://amoy.polygonscan.com/tx/0xa8d71d7e439595e107b9b1313239c5c4efe9c8cba8b7ed9c08ffe889a0910ec2) |
| Attestor role 2 | n/a | [`0xca35069e…4a3a55`](https://amoy.polygonscan.com/tx/0xca35069e64573e30c3832943e4f341f226eb29a184e3d6d61d0f6c3b1f4a3a55) |
| Council member 1 (`setCouncilMember`) | n/a | [`0x8440789d…1153e5`](https://amoy.polygonscan.com/tx/0x8440789d3b55f173f8076ee12c6fb82869b241d0a2c213cce0156aa07e1153e5) |
| Council member 2 | n/a | [`0x465ffc5d…e142c5`](https://amoy.polygonscan.com/tx/0x465ffc5d8c2e2373354cc40da45d6e8877b43daec79a5e9a8143e245ece142c5) |
| Council member 3 | n/a | [`0x0d245722…655852`](https://amoy.polygonscan.com/tx/0x0d245722e636ab9d323c60cab913a4962dd7a906d4af7133261472cd5f655852) |
| Gas top-up to donor wallet (app sponsor) | n/a | [`0x260e0b16…670342`](https://amoy.polygonscan.com/tx/0x260e0b16677977f4982c05c9b1c0837386d64abf11fc6a1fbbc14109fd670342) |
| MockINR mint to donor | n/a | [`0x6a5657c6…9923e7`](https://amoy.polygonscan.com/tx/0x6a5657c6608854c277ed7c0ad208884b1d98de35570d27cfb1c65667739923e7) |
| MockINR approve (donor to vault) | n/a | [`0xd679683c…69c67b`](https://amoy.polygonscan.com/tx/0xd679683c0f626ecb52be7e1265f8b17b87914eda55e5fb8b542cf0bbc069c67b) |
| MockINR approve (organizer to Disbursement), payout M1 | n/a | [`0xe1b38d96…ec819e`](https://amoy.polygonscan.com/tx/0xe1b38d96523da682c2ab418c672fffa82f614a21fe22e0ff37f86aa6f7ec819e) |
| MockINR approve (organizer to Disbursement), payout M2 | n/a | [`0xed501843…fbe4c9`](https://amoy.polygonscan.com/tx/0xed5018437b727020224b70ac1a6ed2fa8f1b2dd51b22ca758884d98bd9fbe4c9) |

The two "defined" transactions are the app registering the campaign's milestones on the manager right after the vault was created.

### 2.3 Earlier run (2026-09-30, "run 4")

Old Factory, vault [`0x0e6680d865ddd5de88c0f33d0ee78e54ec913ed7`](https://amoy.polygonscan.com/address/0x0e6680d865ddd5de88c0f33d0ee78e54ec913ed7), same contracts except the Factory. Taken from the app's indexed `chain_events` table; the createCampaign and donation transactions for this run are not in that table.

| Step | Block | Transaction |
|---|---|---|
| M1 attestation 1 | 48939529 | [`0x70d484dd…9a81ff`](https://amoy.polygonscan.com/tx/0x70d484dd29caca3f75ec4adc7a4abae7b5fe7f3185df1bd29fe8b02e6d9a81ff) |
| M1 attestation 2 | 48939539 | [`0x55fd9d24…7a0fc5`](https://amoy.polygonscan.com/tx/0x55fd9d2400f30416e033338d2c2db659d3a77b0992c10c828c9c37fb007a0fc5) |
| M1 release | 48939543 | [`0xbc997de9…512e7c`](https://amoy.polygonscan.com/tx/0xbc997de937553765d487f4a1b2ac4ec7edcb64f482c0ea3b26641248cb512e7c) |
| M2 attestation 1 | 48939549 | [`0x25e909bd…453c6b`](https://amoy.polygonscan.com/tx/0x25e909bd91a92184f386b7d66fb1918dd1baf2b2bceef670e683e34a9d453c6b) |
| M2 attestation 2 | 48939555 | [`0x652bb5f8…916d6d`](https://amoy.polygonscan.com/tx/0x652bb5f8cb278f7b171b5dd6510526ea41598e29eb527ff70be3c28c0c916d6d) |
| M2 council approval 1 | 48939564 | [`0x5aba3842…2e502b`](https://amoy.polygonscan.com/tx/0x5aba38421b568e8e61036c1306b26a5ef860be7f2f867343c7a6f40b942e502b) |
| M2 council approval 2 | 48939575 | [`0xc9f23f98…268c17`](https://amoy.polygonscan.com/tx/0xc9f23f98e916e6061f0fd1c682d7ece7a14b5194a1f817f46a3e4c9d2e268c17) |
| M2 council approval 3 | 48939584 | [`0x77eef1f3…30ca2f`](https://amoy.polygonscan.com/tx/0x77eef1f38b7a1b27cc03904265aa4c81b940e9639fc46668eceb8c1b1730ca2f) |
| M2 release | 48939587 | [`0x13579304…c103c2`](https://amoy.polygonscan.com/tx/0x13579304719e244073791fc048f09568d56a073347e191af4628bfe0a4c103c2) |
| Beneficiary registered | 48939592 | [`0x44879fff…8605db`](https://amoy.polygonscan.com/tx/0x44879fffa4ca80278e279eebad18345958bfb5c8fb81acc0ba2cff8ee28605db) |
| Payout recorded (30 mINR per the log) | 48939598 | [`0xeeaf44ac…0211b4`](https://amoy.polygonscan.com/tx/0xeeaf44ac864d05355d1f6c542be8c3102736e7b31bcedc2f736e123ffc0211b4) |

## 3. How to reproduce

### 3.1 Contract tests, coverage, gas (free, local)

```bash
cd contracts
forge test                      # 94 tests, 7 suites, fuzz 10,000 runs per fuzz test (as of this pass; 122 tests, 9 suites after the V2 contracts)
forge test --gas-report         # min / avg / median / max per function
forge coverage --report summary
slither . --exclude-dependencies
```

### 3.2 Read a transaction from the chain (free)

```bash
R=https://polygon-amoy.drpc.org
cast receipt <hash> --rpc-url $R                      # gasUsed, block, status, logs
cast run <hash> --rpc-url https://polygon-amoy.gateway.tenderly.co   # replay with a call trace
```

`cast run` replays the transaction in Foundry's EVM against the chain state; use an RPC that serves historical state (drpc returned HTTP 500 and publicnode returned a state error for the replay, tenderly worked).

### 3.3 Independent balance check (free, no app code)

```bash
node scripts/verify-vault.mjs                       # the demo vault above
node scripts/verify-vault.mjs <vault> --from-block <creation block> --rpc <url>
```

### 3.4 Re-run the whole live scenario (spends POL)

Follow [`docs/manual_test_live.md`](manual_test_live.md). The local, free equivalent on anvil is [`docs/manual_test_local.md`](manual_test_local.md).

## 4. Test results (task 1)

`forge test`: **94 passed, 0 failed, 0 skipped** in 7 suites.

| Suite | Passed |
|---|---|
| `MockINR.t.sol` | 2 |
| `CampaignFactory.t.sol` | 16 |
| `CampaignVault.t.sol` | 9 |
| `CampaignVaultRefund.t.sol` | 18 |
| `MilestoneManager.t.sol` | 21 |
| `BeneficiaryRegistry.t.sol` | 13 |
| `Disbursement.t.sol` | 15 |
| **Total** | **94** |

(Source: [`evidence/forge-gas-report.txt`](evidence/forge-gas-report.txt). The web app's own suite, `pnpm test:web`, was not re-run in this pass; the progress log has 397 passed, 3 live tests skipped.)

## 5. Coverage (task 1)

`forge coverage --report summary` ([raw](evidence/forge-coverage.txt)). Foundry reports lines, statements, branches and functions; percentages with counts:

| Contract | Lines | Statements | Branches | Functions |
|---|---|---|---|---|
| `BeneficiaryRegistry` | 100.00% (7/7) | 100.00% (9/9) | 100.00% (3/3) | 100.00% (1/1) |
| `CampaignFactory` | 94.74% (36/38) | 97.73% (43/44) | 100.00% (8/8) | 87.50% (7/8) |
| `CampaignVault` | 100.00% (67/67) | 96.39% (80/83) | 79.17% (19/24) | 100.00% (13/13) |
| `Disbursement` | 100.00% (24/24) | 100.00% (39/39) | 100.00% (9/9) | 100.00% (3/3) |
| `MilestoneManager` | 96.51% (83/86) | 91.74% (111/121) | 68.00% (17/25) | 86.67% (13/15) |
| `MockINR` | 100.00% (4/4) | 100.00% (2/2) | 100.00% (0/0, nothing to branch on) | 100.00% (2/2) |
| **Six contracts together** | **97.8% (221/226)** | **95.3% (284/298)** | **81.2% (56/69)** | **92.9% (39/42)** |
| `script/Deploy.s.sol` (not a contract under test) | 0.00% (0/10) | 0.00% (0/14) | 0.00% (0/1) | 0.00% (0/1) |
| Foundry's "Total" row, which includes the deploy script | 93.64% (221/236) | 91.03% (284/312) | 80.00% (56/70) | 90.70% (39/43) |

The "six contracts together" row is my sum of the six `src/` rows (the deploy script has no tests and is excluded); Foundry's own total includes it, so the two differ on every column except the covered counts. Branch coverage is the weakest figure: `MilestoneManager` 68% and `CampaignVault` 79%. Coverage was run with the repo's default profile (fuzz 10,000 runs); Foundry coverage disables the optimizer, so counts are on unoptimized code.

## 6. Gas

### 6.1 Foundry gas report (task 1)

Min / avg / median / max in gas per call, from `forge test --gas-report` (full table with the deployment costs and sizes: [raw](evidence/forge-gas-report.txt)). "Calls" is how many times the tests, including the 10,000-run fuzz tests, called the function.

**BeneficiaryRegistry**

| Function | Min | Avg | Median | Max | Calls |
|---|---|---|---|---|---|
| `register` | 25,472 | 53,578 | 56,753 | 74,225 | 3,910 |
| `isRegistered` | 3,069 | 3,069 | 3,069 | 3,069 | 3,161 |
| `beneficiaryCount` | 2,780 | 2,780 | 2,780 | 2,780 | 485 |

**CampaignFactory**

| Function | Min | Avg | Median | Max | Calls |
|---|---|---|---|---|---|
| `createCampaign` | 25,955 | 1,501,429 | 1,561,227 | 1,561,227 | 256 |
| `setOrganizerVerified` | 48,334 | 48,334 | 48,334 | 48,334 | 253 |
| `setMilestoneManager` | 24,058 | 44,237 | 47,592 | 47,592 | 19 |
| `getCampaign` | 12,578 | 12,578 | 12,578 | 12,578 | 1 |
| `getCampaignsByOrganizer` | 5,774 | 5,774 | 5,774 | 5,774 | 1 |
| `campaignCount` | 2,485 | 2,485 | 2,485 | 2,485 | 1 |

**CampaignVault**

| Function | Min | Avg | Median | Max | Calls |
|---|---|---|---|---|---|
| `deposit` | 29,141 | 105,121 | 125,565 | 131,912 | 1,977 |
| `claimRefund` | 28,850 | 93,127 | 96,602 | 96,602 | 732 |
| `close` | 28,831 | 61,697 | 62,135 | 62,541 | 255 |
| `releaseForMilestone` | 27,446 | 34,685 | 27,458 | 49,153 | 3 |
| `pause` | 29,041 | 29,185 | 29,197 | 29,317 | 3 |
| `unpause` | 27,150 | 27,150 | 27,150 | 27,150 | 1 |
| `setMilestoneManager` | 21,540 | 21,540 | 21,540 | 21,540 | 1 |
| `refundOf` | 12,105 | 12,105 | 12,105 | 12,105 | 8 |
| `closableReason` | 11,666 | 11,666 | 11,666 | 11,666 | 2 |
| `getBalance` | 2,543 | 2,543 | 2,543 | 2,543 | 2,208 |
| `refundPool` | 2,471 | 2,471 | 2,471 | 2,471 | 243 |
| `closed` | 2,628 | 2,628 | 2,628 | 2,628 | 2 |
| `lastProgressAt` | 2,581 | 2,581 | 2,581 | 2,581 | 1 |
| `milestoneManager` | 463 | 463 | 463 | 463 | 1,558 |
| `organizer` | 396 | 396 | 396 | 396 | 7,725 |
| `deadline` | 376 | 376 | 376 | 376 | 2 |
| `inactivityWindow` | 354 | 354 | 354 | 354 | 2 |

**Disbursement**

| Function | Min | Avg | Median | Max | Calls |
|---|---|---|---|---|---|
| `disburse` | 32,731 | 97,640 | 57,887 | 150,844 | 498 |
| `payableRemaining` | 8,965 | 9,139 | 9,141 | 9,141 | 239 |
| `disbursedTotal` | 2,845 | 2,845 | 2,845 | 2,845 | 485 |
| `isDisbursed` | 3,071 | 3,071 | 3,071 | 3,071 | 2 |

**MilestoneManager**

| Function | Min | Avg | Median | Max | Calls |
|---|---|---|---|---|---|
| `defineMilestone` | 26,119 | 133,005 | 116,273 | 150,473 | 1,058 |
| `submitAttestation` | 24,854 | 85,590 | 83,397 | 88,028 | 1,513 |
| `councilApprove` | 24,537 | 66,692 | 59,467 | 76,567 | 1,727 |
| `release` | 32,297 | 123,461 | 143,612 | 143,612 | 756 |
| `getMilestone` | 17,190 | 17,190 | 17,190 | 17,190 | 485 |
| `setAttestor` | 24,551 | 47,998 | 48,162 | 48,174 | 144 |
| `setCouncilMember` | 24,529 | 48,024 | 48,140 | 48,140 | 205 |
| `setCouncilThreshold` | 24,131 | 30,098 | 30,148 | 30,148 | 243 |
| `setAutoReleaseLimit` | 24,256 | 28,351 | 30,225 | 30,573 | 3 |
| `releasedPct` | 2,891 | 2,891 | 2,891 | 2,891 | 255 |
| `releasedTotal` | 2,870 | 2,870 | 2,870 | 2,870 | 723 |

**MockINR**

| Function | Min | Avg | Median | Max | Calls |
|---|---|---|---|---|---|
| `mint` | 34,447 | 55,697 | 51,595 | 69,043 | 2,224 |
| `approve` | 29,768 | 45,062 | 46,904 | 47,240 | 2,234 |
| `transfer` | 47,137 | 47,137 | 47,137 | 47,137 | 1 |
| `balanceOf` | 2,850 | 2,850 | 2,850 | 2,850 | 2,188 |
| `decimals` | 427 | 427 | 427 | 427 | 1 |

### 6.2 The three outliers (task 2)

Receipts via `cast receipt` (drpc), call traces via `cast run` (tenderly). All three transactions were at an effective gas price of 33.0 gwei. Raw traces: [`createCampaign`](evidence/trace-createCampaign.txt), [`release`](evidence/trace-release-M1.txt), [`payout`](evidence/trace-payout-M1.txt), plus a fourth point, the [donation](evidence/trace-deposit.txt).

| Transaction | On-chain `gasUsed` | minus 21,000 | Foundry max | Over Foundry (the "about N over" figure) | Replay in Foundry's EVM (`cast run`, total) | On-chain minus replay |
|---|---|---|---|---|---|---|
| `createCampaign` `0x78852ab6…` (block 51138740) | 1,591,479 | 1,570,479 | 1,561,227 | **9,252** | 1,561,239 | **30,240** |
| Release M1 `0x3e85c1e9…` (block 51139510) | 182,503 | 161,503 | 143,612 | **17,891** | 142,183 | **40,320** |
| Payout M1 `0x83eab522…` (block 51140084) | 177,640 | 156,640 | 150,844 | **5,796** | 128,920 | **48,720** |
| Donation `0x0a76a89f…` (block 51139137), extra point | 152,457 | 131,457 | 131,912 | −455 | 125,577 | 26,880 |

Your three figures reproduce exactly (9,252 / 17,891 / 5,796 against the Foundry maximum after subtracting 21,000).

What the traces show, and what they do not:

1. **The call paths are exactly what the code says, with nothing extra.** Release M1 is `release → getBalance, organizer, releaseForMilestone → token.transfer`, then the `MilestoneReleased` event. Payout M1 is `disburse → organizer, milestoneManager, getMilestone, registry.isRegistered, releasedTotal, token.transferFrom`, then `PayoutRecorded`. `createCampaign` is one `CREATE` of the vault (6,541 bytes of code, 1,355,705 gas) plus the `CampaignCreated` event. None of them hit a path the Foundry tests do not exercise, so the outliers are not caused by different logic.
2. **Calldata is a small part of it.** `createCampaign` calldata is 292 bytes = 1,396 gas. Release and payout calldata are 68 and 164 bytes, at most about 2,600 gas.
3. **Foundry's own engine, run on the real chain state, reproduces the Foundry range.** The replay of `createCampaign` costs 1,561,239 in total (1,538,843 inside the call plus 21,000 base plus 1,396 calldata), within 12 gas of Foundry's 1,561,227. The release and payout replays (142,183 and 128,920) sit inside or below the Foundry range too. So the contract code is not what costs more.
4. **The remaining difference is on-chain only and I could not attribute it.** Real Amoy used 30,240 (create), 40,320 (release), 48,720 (payout) and 26,880 (donation) more gas than the same transaction replayed in Foundry. All four are multiples of 1,680 (18, 24, 29 and 16 times), which is a pattern worth noting but not an explanation. The likely cause is that Amoy's client charges some operations differently from Foundry's default EVM schedule, but I cannot confirm that: a per-opcode trace of the real execution needs `debug_traceTransaction`, which none of the three free RPCs would serve (drpc returned a 500, publicnode said the method does not exist, tenderly rate-limited). Getting it would need an RPC provider with debug APIs (an Alchemy or QuickNode key), or running a full Bor node.
5. **A correction to the comparison.** Because the Foundry `createCampaign` figure equals the full-transaction replay (which includes the 21,000 base and calldata), the Foundry gas report seems to already include those, and subtracting 21,000 from the on-chain figure then understates the gap. Like for like, the gap against the Foundry maximum is 30,252 (create), 38,891 (release) and 26,796 (payout). Either way the paper should say that Foundry's report and real Amoy receipts differ by tens of thousands of gas per transaction, not describe the gap as 6,000 to 18,000. I have not checked how the paper currently words it.

### 6.3 Deployment cost

The Foundry deployment cost and size for every contract are in the raw table ([`evidence/forge-gas-report.txt`](evidence/forge-gas-report.txt)).

## 7. Static analysis

### 7.1 Slither (task 3)

Slither 0.11.6 over the whole `contracts/` tree, run from `contracts/` (25 contracts, 102 detectors; it runs `forge clean` and rebuilds, skipping `test/` and `script/`):

- **Project code only** (`slither . --exclude-dependencies`): **9 results, 0 high, 1 medium, 7 low, 1 informational** ([raw](evidence/slither-project-code.txt)).
- **Including the OpenZeppelin dependencies** (`slither .`): **26 results** in 7 detector types ([raw](evidence/slither-with-dependencies.txt)). The extra 17 are all in `lib/` (pragma and solc-version notes, assembly in OpenZeppelin). This is the "17 informational items" in the progress log.

This resolves the 4-versus-8 question in the log. The count has depended on three things:

| Count | What it was |
|---|---|
| 4 | before campaign expiry was added: the 4 non-timestamp findings below |
| 8 | after expiry, counting the 4 new timestamp findings, and **excluding** the pragma note |
| 9 | the same 8 plus the one pragma note that `--exclude-dependencies` still reports (it counts the project's `^0.8.24` against the OpenZeppelin pragmas it imports) |

The 9 results, exactly (impact and confidence are Slither's, from `--json`):

| # | Detector | Impact | Where | Assessment |
|---|---|---|---|---|
| 1 | `uninitialized-local` | **Medium** | `CampaignFactory.createCampaign`, `sum` ([line 139](../contracts/src/CampaignFactory.sol#L139)) | False positive: `uint256 sum;` deliberately starts at 0 and is accumulated in the next loop. |
| 2 | `events-maths` | Low | `CampaignVault.releaseForMilestone`, `_balance -= amount` ([line 174](../contracts/src/CampaignVault.sol#L174)) | Real but harmless: the vault emits no event on release by design; `MilestoneManager` emits `MilestoneReleased` and the ledger reads that. |
| 3 | `missing-zero-check` | Low | `CampaignFactory.constructor`, `_mockToken` ([line 91](../contracts/src/CampaignFactory.sol#L91)) | Deploy-time argument; a zero token would make the Factory useless but cannot move funds. |
| 4 | `missing-zero-check` | Low | `CampaignVault.constructor`, `_organizer` ([line 122](../contracts/src/CampaignVault.sol#L122)) | The Factory passes `msg.sender`, which is a verified organizer, never zero. |
| 5 | `timestamp` | Low | `CampaignFactory.createCampaign`, deadline bounds ([line 145](../contracts/src/CampaignFactory.sol#L145)) | Intended: deadlines are in days or months, miner skew of seconds is irrelevant. |
| 6 | `timestamp` | Low | `CampaignVault.constructor`, `_deadline <= block.timestamp \|\| _inactivityWindow == 0` ([line 124](../contracts/src/CampaignVault.sol#L124)) | Same. |
| 7 | `timestamp` | Low | `CampaignVault.deposit`, `block.timestamp > deadline` ([line 141](../contracts/src/CampaignVault.sol#L141)) | Same. |
| 8 | `timestamp` | Low | `CampaignVault.closableReason`, two comparisons ([lines 187-188](../contracts/src/CampaignVault.sol#L187-L188)) | Same. |
| 9 | `pragma` | Informational | five different Solidity version constraints across the project and OpenZeppelin | Project files all use `^0.8.24`; the others come from the imported libraries. |

So the accurate statement for the paper is: **no high, one medium that is a false positive, seven low, one informational**. Earlier text saying "0 medium/high" in the docs and README is slightly off, since Slither does class that false positive as medium. The assessments in the last column are my reading of the code, not Slither output.

### 7.2 Mythril (task 3)

**Not run. This is not a finding that Mythril cannot run on Windows; I could not finish setting it up.**

- Mythril's supported routes are Linux, WSL or its Docker image (`mythril/myth`). I tried the native Windows route first: `pip install mythril` into a fresh virtual environment (Python 3.12). It resolved and began downloading dependencies (it needs a source build of `coverage<7` and a 59 MB `z3-solver` wheel), but this machine's connection was running at about 25 kB/s, so the z3 download alone would have taken about 40 minutes and I stopped it. No Mythril analysis was run and there is no Mythril output.
- The Docker route is unavailable right now: Docker Desktop is installed but its engine was not running (`docker info` could not reach the daemon). I did not start it or pull the image.
- Mythril would also need a Solidity compiler matching the contracts (`^0.8.24`) and is slow on contracts with deep call trees such as `CampaignFactory` (it deploys a `CampaignVault`).

Recommendation: unless you want to run it via Docker or WSL, drop Mythril from the paper and say only Slither (plus 10,000-run Foundry fuzzing) was used. The paper currently names Mythril and the docs show it was never run.

## 8. Independent verifier (task 4)

[`scripts/verify-vault.mjs`](../scripts/verify-vault.mjs) is a single file with no dependencies and no app imports. It speaks JSON-RPC directly, with the event topics and function selectors hardcoded (each derived with `cast sig-event` / `cast sig`, noted in the file). It reads `DonationReceived` and `RefundClaimed` from the vault and `MilestoneReleased` from the vault's `MilestoneManager` (the manager address and the token address are read from the vault itself, not from config), rebuilds the balance as donated minus released minus refunded, and compares it with the vault's `getBalance()` and the token's `balanceOf(vault)`, all state reads pinned to the same block. `PayoutRecorded` logs from `Disbursement` are listed for information; they do not change the vault balance. Exit code 0 means match.

Run on the demo vault at the latest block (block 52121465) ([full output](evidence/verify-vault-output.txt)):

```
donated              250000000 (250 mINR)  (1 events, 1 donors)
released             250000000 (250 mINR)  (2 events)
refunded             0 (0 mINR)  (0 events)
paid out (recorded)  200000000 (200 mINR)  (2 events)
rebuilt from logs    0 (0 mINR)
vault getBalance()   0 (0 mINR)
token balanceOf()    0 (0 mINR)
rebuilt == getBalance()  MATCH
rebuilt == balanceOf()   MATCH
RESULT: verified, zero difference
```

A fully released vault reconciles to 0 = 0, which is a weak test on its own, so the script can be pinned to an earlier block. At block 51139600 (after the donation and the first release) ([full output](evidence/verify-vault-midpoint-output.txt)) it rebuilds **150 mINR** (250 donated minus 100 released) and both `getBalance()` and `balanceOf()` read 150 mINR at that block: a non-trivial match.

Limits: this checks one vault's own accounting against the token. It does not check that the organizer or Disbursement behaved correctly after funds left the vault (the 200 of 250 mINR recorded as paid out is only what `Disbursement` logged), and it trusts the RPC to return real logs. Refund handling is covered by the code path but this vault had no refunds, so `RefundClaimed` was exercised only in the local tests.

## 9. Not done in this pass

- **Source verification on Polygonscan:** needs a Polygonscan/Etherscan API key. With a key, per contract: `forge verify-contract <address> src/<File>.sol:<Name> --chain 80002 --etherscan-api-key $KEY --watch` (add `--constructor-args $(cast abi-encode "constructor(address)" <arg>)` for the Factory and the other constructors that take arguments). Not run.
- **Hash brute-force and Argon2id benchmark:** not run. The figures in the paper remain estimates.
- **`pnpm test:web`** was not re-run.
