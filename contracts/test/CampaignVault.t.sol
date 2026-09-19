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
    address internal manager = address(0x4444);

    function setUp() public {
        token = new MockINR();
        vault = new CampaignVault(address(token), organizer, manager);

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

    function test_ManagerIsFixedAtConstruction() public view {
        assertEq(vault.milestoneManager(), manager);
    }

    function test_RevertConstructorZeroManager() public {
        vm.expectRevert(CampaignVault.ZeroAddress.selector);
        new CampaignVault(address(token), organizer, address(0));
    }

    /// @dev Regression for the drain bug: no function exists that lets any caller change the
    ///      manager, so a stranger can never obtain release rights.
    function test_StrangerCannotBecomeManagerAndDrain() public {
        vm.prank(donor);
        vault.deposit(100e6);

        (bool ok,) = address(vault).call(abi.encodeWithSignature("setMilestoneManager(address)", notManager));
        assertFalse(ok);

        vm.prank(notManager);
        vm.expectRevert(CampaignVault.NotMilestoneManager.selector);
        vault.releaseForMilestone(notManager, 100e6);
        assertEq(vault.getBalance(), 100e6);
    }

    function test_RevertReleaseWhenCallerNotManager() public {
        vm.prank(donor);
        vault.deposit(100e6);

        vm.prank(notManager);
        vm.expectRevert(CampaignVault.NotMilestoneManager.selector);
        vault.releaseForMilestone(donor, 50e6);
    }

    function test_ManagerCanReleaseWithinBalance() public {
        vm.prank(donor);
        vault.deposit(100e6);

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
