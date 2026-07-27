// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockINR} from "../src/MockINR.sol";
import {CampaignVault} from "../src/CampaignVault.sol";

contract CampaignVaultTest is Test {
    MockINR internal token;
    CampaignVault internal vault;

    address internal organizer = address(0x1111);
    address internal donor = address(0x2222);
    address internal notManager = address(0x3333);

    function setUp() public {
        token = new MockINR();
        vault = new CampaignVault(address(token), organizer);

        token.mint(donor, 1_000e6);
        vm.prank(donor);
        token.approve(address(vault), type(uint256).max);
    }

    function test_DepositIncreasesBalanceAndEmitsEvent() public {
        vm.prank(donor);
        vm.expectEmit(true, false, false, true);
        emit CampaignVault.DonationReceived(donor, 100e6, 100e6);
        vault.deposit(100e6);

        assertEq(vault.getBalance(), 100e6);
        assertEq(token.balanceOf(address(vault)), 100e6);
    }

    function test_RevertOnZeroAmountDeposit() public {
        vm.prank(donor);
        vm.expectRevert(CampaignVault.ZeroAmount.selector);
        vault.deposit(0);
    }

    function test_SetMilestoneManagerOnce() public {
        vault.setMilestoneManager(address(0x4444));
        assertEq(vault.milestoneManager(), address(0x4444));

        vm.expectRevert(CampaignVault.MilestoneManagerAlreadySet.selector);
        vault.setMilestoneManager(address(0x5555));
    }

    function test_RevertReleaseWhenCallerNotManager() public {
        vm.prank(donor);
        vault.deposit(100e6);

        vault.setMilestoneManager(address(0x4444));

        vm.prank(notManager);
        vm.expectRevert(CampaignVault.NotMilestoneManager.selector);
        vault.releaseForMilestone(donor, 50e6);
    }

    function test_ManagerCanReleaseWithinBalance() public {
        vm.prank(donor);
        vault.deposit(100e6);

        address manager = address(0x4444);
        vault.setMilestoneManager(manager);

        vm.prank(manager);
        vault.releaseForMilestone(donor, 40e6);

        assertEq(vault.getBalance(), 60e6);
        assertEq(token.balanceOf(donor), 900e6 + 40e6); // 1000 minted - 100 deposited + 40 released
    }

    function test_PausedVaultRejectsDeposit() public {
        vm.prank(organizer);
        vault.pause("compliance review");

        vm.prank(donor);
        vm.expectRevert(CampaignVault.VaultPaused.selector);
        vault.deposit(10e6);
    }

    function testFuzz_DepositArbitraryAmounts(uint96 amount) public {
        vm.assume(amount > 0);
        token.mint(donor, amount);

        vm.startPrank(donor);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();

        assertEq(vault.getBalance(), amount);
        assertEq(token.balanceOf(address(vault)), amount);
    }
}
