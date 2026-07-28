// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockINR} from "../src/MockINR.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";

/// @title Deploy
/// @notice Deploys the Phase 1 / Step 3 contract skeleton (MockINR + CampaignFactory) to a
///         public testnet. Ref: SPDD §16 Step 3, §22.3 (manually-triggered forge script).
/// @dev Run with: forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        MockINR mockINR = new MockINR();
        CampaignFactory factory = new CampaignFactory(address(mockINR));

        vm.stopBroadcast();

        console.log("MockINR deployed at:      ", address(mockINR));
        console.log("CampaignFactory deployed at:", address(factory));
    }
}
