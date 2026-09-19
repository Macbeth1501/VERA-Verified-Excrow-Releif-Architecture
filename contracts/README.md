# VERA contracts

The smart contracts for VERA (Verified Escrow & Relief Architecture), built with [Foundry](https://book.getfoundry.sh/) and OpenZeppelin v5 (Solidity ^0.8.24). They run on the Polygon Amoy testnet, with no real value.

For the current state, deployed addresses and open issues, read [`docs/PROGRESS_LOG.md`](../docs/PROGRESS_LOG.md). The design source of truth is [`docs/VERA_MVP_SPDD.md`](../docs/VERA_MVP_SPDD.md) (§18 covers the contracts); code comments cite its sections.

## Contracts

| Contract | Role |
|---|---|
| `MockINR` | A free mock rupee token (`mINR`, 6 decimals) with an open `mint` faucet, standing in for a real stablecoin. Testnet only. |
| `CampaignFactory` | Deploys one vault per campaign and enforces, on-chain and non-bypassably: the organizer is verified, the admin-cost cap does not exceed the category ceiling (10% disaster relief, 15% medical, 20% community), and the milestone percentages sum to exactly 100. The owner verifies organizers and sets the milestone manager. |
| `CampaignVault` | Holds one campaign's escrowed mINR. Anyone can deposit; funds leave only through `releaseForMilestone`, callable solely by the milestone manager fixed at construction (no setter, no admin override). Has an optional, disclosed `pause`. |
| `MilestoneManager` | One shared contract for every vault (Amoy: `0xe6d7222dDe3eE4b9688269427631aDF49229e747`). The vault's organizer registers milestones (at least 2 confirmations each); owner-curated attestors confirm them once each (never the organizer); at M a milestone is Verified. A release is permissionless once milestones total 100, go in order and are Verified, and needs `councilThreshold` (3) council approvals when it exceeds the auto-release limit (100 mINR). Pays the campaign's organizer and emits `MilestoneReleased`. |

`CampaignVault.releaseForMilestone` emits no event, so `MilestoneManager.MilestoneReleased` is the only record of a release (the web app's indexer reads it). Vaults created before the real manager was set (Factory campaigns #0-#3) are bound to a placeholder and can never release funds. See the progress log.

## Commands

Run from this directory:

```bash
forge build
forge test                                        # 45 tests; fuzz tests run 10,000 times
forge test --match-contract CampaignFactoryTest   # one contract
forge test --match-test testFuzz_ -vvv            # by name, verbose
```

## Deploying

`script/Deploy.s.sol` deploys `MockINR` and `CampaignFactory`. It reads `DEPLOYER_PRIVATE_KEY` from `contracts/.env` (gitignored; see the root `.env.example`) and optionally `MILESTONE_MANAGER`:

```bash
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

A campaign cannot be created until the Factory has a milestone manager, because every vault binds its manager permanently when it is created.

**Spending POL:** Amoy's gas price is normally about 30 gwei but has spiked past 500, and one uncapped `forge create` of `MilestoneManager` cost 1.41 POL. Check `cast gas-price` first and pass `--gas-price` (for example `--gas-price 60gwei --priority-gas-price 30gwei`). Deploy `MilestoneManager` with `forge create src/MilestoneManager.sol:MilestoneManager --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast --constructor-args <autoReleaseLimit> <councilThreshold>`. Slither (`py -m slither src/MilestoneManager.sol --filter-paths lib/`) reports no findings.

Testnet POL for gas comes from a faucet; see [`docs/mining_instructions.md`](../docs/mining_instructions.md).

Two Foundry details worth remembering: `forge create` takes `--constructor-args` as its **last** flag (it swallows the flags after it), and `forge install` was run with `--no-git`, so `lib/` holds plain files rather than submodules.
