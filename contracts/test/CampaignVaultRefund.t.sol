// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockINR} from "../src/MockINR.sol";
import {CampaignVault} from "../src/CampaignVault.sol";
import {MilestoneManager} from "../src/MilestoneManager.sol";

/// @notice Campaign expiry: a deadline, an inactivity window, and refunds to donors.
contract CampaignVaultRefundTest is Test {
    MockINR token;
    MilestoneManager mgr;
    CampaignVault vault;

    address organizer = address(0x0F0F);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address stranger = address(0x5712);
    address a1 = address(0xA1);
    address a2 = address(0xA2);
    address[3] council = [address(0xC1), address(0xC2), address(0xC3)];

    uint64 constant DEADLINE_IN = 90 days;
    uint64 constant WINDOW = 30 days;
    uint256 constant LIMIT = 1_000e6; // auto-release up to 1,000 mINR so no council is needed

    function setUp() public {
        token = new MockINR();
        mgr = new MilestoneManager(LIMIT, 3);
        vault = new CampaignVault(
            address(token), organizer, address(mgr), uint64(block.timestamp) + DEADLINE_IN, WINDOW
        );
        mgr.setAttestor(a1, true);
        mgr.setAttestor(a2, true);
        for (uint256 i = 0; i < 3; i++) mgr.setCouncilMember(council[i], true);

        vm.startPrank(organizer);
        mgr.defineMilestone(address(vault), 40, 2);
        mgr.defineMilestone(address(vault), 60, 2);
        vm.stopPrank();
    }

    function _give(address donor, uint256 amount) internal {
        token.mint(donor, amount);
        vm.startPrank(donor);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function _verifyAndRelease(uint256 index) internal {
        vm.prank(a1);
        mgr.submitAttestation(address(vault), index, keccak256("proof"));
        vm.prank(a2);
        mgr.submitAttestation(address(vault), index, keccak256("proof"));
        mgr.release(address(vault), index);
    }

    // ------------------------------------------------------------ deadline

    function test_ScheduleIsStored() public view {
        assertEq(vault.deadline(), uint64(block.timestamp) + DEADLINE_IN);
        assertEq(vault.inactivityWindow(), WINDOW);
        assertEq(vault.lastProgressAt(), uint64(block.timestamp));
    }

    function test_RevertConstructorPastDeadlineOrZeroWindow() public {
        vm.expectRevert(CampaignVault.InvalidSchedule.selector);
        new CampaignVault(address(token), organizer, address(mgr), uint64(block.timestamp), WINDOW);
        vm.expectRevert(CampaignVault.InvalidSchedule.selector);
        new CampaignVault(address(token), organizer, address(mgr), uint64(block.timestamp + 1 days), 0);
    }

    function test_DonationsStopAfterDeadline() public {
        vm.warp(block.timestamp + DEADLINE_IN + 1);
        token.mint(alice, 10e6);
        vm.startPrank(alice);
        token.approve(address(vault), 10e6);
        vm.expectRevert(CampaignVault.DonationsClosed.selector);
        vault.deposit(10e6);
        vm.stopPrank();
    }

    function test_NoWorkDoneAtDeadlineRefundsEveryoneProRata() public {
        _give(alice, 300e6);
        _give(bob, 100e6);
        // Keep the inactivity timer out of it: only the deadline applies here.
        vm.warp(block.timestamp + DEADLINE_IN + 1);

        vm.expectEmit(false, false, false, true);
        emit CampaignVault.CampaignClosed(CampaignVault.CloseReason.Deadline, 400e6);
        vm.prank(stranger);
        vault.close();

        assertTrue(vault.closed());
        assertEq(vault.refundPool(), 400e6);
        assertEq(vault.refundOf(alice), 300e6);
        assertEq(vault.refundOf(bob), 100e6);

        vm.prank(alice);
        vault.claimRefund();
        vm.prank(bob);
        vault.claimRefund();

        assertEq(token.balanceOf(alice), 300e6);
        assertEq(token.balanceOf(bob), 100e6);
        assertEq(vault.getBalance(), 0);
        assertEq(token.balanceOf(address(vault)), 0);
    }

    function test_PartiallyReleasedThenDeadlineRefundsTheRest() public {
        _give(alice, 300e6);
        _give(bob, 100e6);
        _verifyAndRelease(0); // 40% of 400 = 160 to the organizer
        assertEq(token.balanceOf(organizer), 160e6);

        vm.warp(block.timestamp + DEADLINE_IN + 1);
        vault.close();

        assertEq(vault.refundPool(), 240e6);
        assertEq(vault.refundOf(alice), 180e6); // 3/4 of the 240 still held
        assertEq(vault.refundOf(bob), 60e6);

        vm.prank(alice);
        vault.claimRefund();
        vm.prank(bob);
        vault.claimRefund();
        assertEq(token.balanceOf(alice), 180e6);
        assertEq(token.balanceOf(bob), 60e6);
        assertEq(vault.getBalance(), 0);
    }

    // ------------------------------------------------------------ inactivity

    function test_StalledCampaignClosesAfterInactivityWindow() public {
        _give(alice, 100e6);
        vm.warp(block.timestamp + WINDOW);
        (bool can,) = vault.closableReason();
        assertFalse(can, "exactly at the window is not yet stalled");

        vm.warp(block.timestamp + 1);
        vm.expectEmit(false, false, false, true);
        emit CampaignVault.CampaignClosed(CampaignVault.CloseReason.Inactivity, 100e6);
        vault.close();
        assertEq(vault.refundOf(alice), 100e6);
    }

    function test_ReleaseResetsTheInactivityClock() public {
        _give(alice, 100e6);
        vm.warp(block.timestamp + 20 days);
        _verifyAndRelease(0);

        vm.warp(block.timestamp + 20 days); // 40 days since creation but 20 since progress
        (bool can,) = vault.closableReason();
        assertFalse(can);
        vm.expectRevert(CampaignVault.CannotCloseYet.selector);
        vault.close();

        vm.warp(block.timestamp + 11 days);
        vault.close();
        assertEq(vault.refundOf(alice), 60e6);
    }

    function test_DonationsDoNotResetTheInactivityClock() public {
        _give(alice, 100e6);
        vm.warp(block.timestamp + 20 days);
        _give(bob, 10e6);
        vm.warp(block.timestamp + 11 days);
        vault.close(); // 31 days after creation, a donation 11 days ago did not count as progress
        assertTrue(vault.closed());
    }

    // ------------------------------------------------------------ completed

    function test_LeftoverAfterAllMilestonesReleasedGoesBackToDonors() public {
        _give(alice, 100e6);
        _verifyAndRelease(0);
        _verifyAndRelease(1);
        assertEq(vault.getBalance(), 0);

        // A late donation arrives after the work is done and stays in the vault.
        _give(bob, 50e6);
        vm.expectEmit(false, false, false, true);
        emit CampaignVault.CampaignClosed(CampaignVault.CloseReason.Completed, 50e6);
        vault.close();

        // Pro rata by what each gave: 100 of 150 and 50 of 150 of the 50 left.
        assertEq(vault.refundOf(alice), 33333333);
        assertEq(vault.refundOf(bob), 16666666);
    }

    // ------------------------------------------------------------ refusals

    function test_CannotCloseEarly() public {
        _give(alice, 100e6);
        vm.expectRevert(CampaignVault.CannotCloseYet.selector);
        vault.close();
    }

    function test_CannotCloseAnEmptyVault() public {
        vm.warp(block.timestamp + DEADLINE_IN + 1);
        vm.expectRevert(CampaignVault.NothingToRefund.selector);
        vault.close();
    }

    function test_CannotCloseTwice() public {
        _give(alice, 100e6);
        vm.warp(block.timestamp + DEADLINE_IN + 1);
        vault.close();
        vm.expectRevert(CampaignVault.AlreadyClosed.selector);
        vault.close();
    }

    function test_ClosedVaultRefusesReleaseAndDeposits() public {
        _give(alice, 100e6);
        vm.prank(a1);
        mgr.submitAttestation(address(vault), 0, keccak256("p"));
        vm.prank(a2);
        mgr.submitAttestation(address(vault), 0, keccak256("p"));
        vm.warp(block.timestamp + DEADLINE_IN + 1);
        vault.close();

        // The milestone was verified, but a closed vault pays nobody but the donors.
        vm.expectRevert(CampaignVault.CampaignIsClosed.selector);
        mgr.release(address(vault), 0);

        token.mint(bob, 5e6);
        vm.startPrank(bob);
        token.approve(address(vault), 5e6);
        vm.expectRevert(CampaignVault.CampaignIsClosed.selector);
        vault.deposit(5e6);
        vm.stopPrank();
    }

    function test_VerifiedButUnreleasedMilestoneCanStillBeReleasedBeforeClosing() public {
        _give(alice, 100e6);
        vm.prank(a1);
        mgr.submitAttestation(address(vault), 0, keccak256("p"));
        vm.prank(a2);
        mgr.submitAttestation(address(vault), 0, keccak256("p"));
        vm.warp(block.timestamp + DEADLINE_IN + 1);
        // Nobody has closed it yet, so the legitimately verified milestone still pays out.
        mgr.release(address(vault), 0);
        assertEq(token.balanceOf(organizer), 40e6);
    }

    function test_ClaimBeforeCloseReverts() public {
        _give(alice, 100e6);
        vm.prank(alice);
        vm.expectRevert(CampaignVault.NotClosed.selector);
        vault.claimRefund();
    }

    function test_ClaimTwiceAndStrangerClaimRevert() public {
        _give(alice, 100e6);
        vm.warp(block.timestamp + DEADLINE_IN + 1);
        vault.close();

        vm.prank(stranger);
        vm.expectRevert(CampaignVault.NoRefundDue.selector);
        vault.claimRefund();

        vm.startPrank(alice);
        vault.claimRefund();
        vm.expectRevert(CampaignVault.NoRefundDue.selector);
        vault.claimRefund();
        vm.stopPrank();
    }

    function test_PauseCannotTrapDonors() public {
        _give(alice, 100e6);
        vm.prank(organizer);
        vault.pause("organizer freezes the vault");

        vm.warp(block.timestamp + DEADLINE_IN + 1);
        vault.close();
        vm.prank(alice);
        vault.claimRefund();
        assertEq(token.balanceOf(alice), 100e6);
    }

    // ------------------------------------------------------------ fuzz

    /// @dev However the money was split, refunds never exceed the pool, and the tracked balance
    ///      always equals the token balance (the reconciliation invariant).
    function testFuzz_RefundsNeverExceedPoolAndBalanceReconciles(uint96 x, uint96 y, uint96 z) public {
        uint256 a = bound(x, 1, 1_000_000e6);
        uint256 b = bound(y, 1, 1_000_000e6);
        uint256 c = bound(z, 1, 1_000_000e6);
        _give(alice, a);
        _give(bob, b);
        _give(stranger, c);

        vm.warp(block.timestamp + DEADLINE_IN + 1);
        vault.close();
        uint256 pool = vault.refundPool();
        assertEq(pool, a + b + c);

        vm.prank(alice);
        vault.claimRefund();
        vm.prank(bob);
        vault.claimRefund();
        vm.prank(stranger);
        vault.claimRefund();

        uint256 paid = token.balanceOf(alice) + token.balanceOf(bob) + token.balanceOf(stranger);
        assertLe(paid, pool);
        assertEq(vault.getBalance(), token.balanceOf(address(vault)));
        assertEq(vault.getBalance(), pool - paid); // only rounding dust can remain
        assertLe(vault.getBalance(), 3);
    }
}
