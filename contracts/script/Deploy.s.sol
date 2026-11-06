// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockINR} from "../src/MockINR.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";

/// @title Deploy
/// @notice Deploys the Phase 1 / Step 3 contract skeleton (MockINR + CampaignFactory) to a
///         public testnet. Ref: SPDD §16 Step 3, §22.3 (manually-triggered forge script).
/// @dev Run with: forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
///      Environment (contracts/.env, see .env.example):
///        DEPLOYER_PRIVATE_KEY  required; signs and pays for the deployment (testnet key only).
///        MILESTONE_MANAGER     optional; if set, the Factory is pointed at this MilestoneManager.
///      RPC_URL selects the chain: a public testnet such as Polygon Amoy, or a local Anvil node
///      (`anvil`, default http://127.0.0.1:8545, chain id 31337) for free dry runs.
///      Prints the deployed MockINR and CampaignFactory addresses; copy them into the web app's
///      env (MOCK_INR_ADDRESS, FACTORY_ADDRESS).
contract Deploy is Script {
    /// @notice Deploys MockINR and CampaignFactory (and wires the milestone manager when MILESTONE_MANAGER is set), broadcasting from DEPLOYER_PRIVATE_KEY.
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        MockINR mockINR = new MockINR();
        CampaignFactory factory = new CampaignFactory(address(mockINR));

        // Vaults bind their MilestoneManager at construction, so the Factory cannot create
        // campaigns until one is set. Optional here; can also be set later by the owner.
        address manager = vm.envOr("MILESTONE_MANAGER", address(0));
        if (manager != address(0)) factory.setMilestoneManager(manager);

        vm.stopBroadcast();

        console.log("MockINR deployed at:      ", address(mockINR));
        console.log("CampaignFactory deployed at:", address(factory));
    }
}
