// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockINR} from "../src/MockINR.sol";
import {CampaignVault} from "../src/CampaignVault.sol";
import {MilestoneManager} from "../src/MilestoneManager.sol";

contract MilestoneManagerTest is Test {
    MockINR token;
    MilestoneManager mgr;
    CampaignVault vault;

    address owner = address(this);
    address organizer = address(0x0F0F);
    address donor = address(0xD0);
    address a1 = address(0xA1);
    address a2 = address(0xA2);
    address a3 = address(0xA3);
    address[5] council = [address(0xC1), address(0xC2), address(0xC3), address(0xC4), address(0xC5)];

    uint256 constant LIMIT = 100e6; // auto-release up to 100 mINR

    function setUp() public {
        token = new MockINR();
        mgr = new MilestoneManager(LIMIT, 3);
        vault = new CampaignVault(address(token), organizer, address(mgr));

        mgr.setAttestor(a1, true);
        mgr.setAttestor(a2, true);
        mgr.setAttestor(a3, true);
        for (uint256 i = 0; i < 5; i++) mgr.setCouncilMember(council[i], true);
    }

    function _fund(uint256 amount) internal {
        token.mint(donor, amount);
        vm.startPrank(donor);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    /// @dev Two milestones, 40% then 60%, each needing 2 attestors.
    function _define() internal {
        vm.startPrank(organizer);
        mgr.defineMilestone(address(vault), 40, 2);
        mgr.defineMilestone(address(vault), 60, 2);
        vm.stopPrank();
    }

    function _attest(uint256 index, address x, address y) internal {
        vm.prank(x);
        mgr.submitAttestation(address(vault), index, keccak256("proof"));
        vm.prank(y);
        mgr.submitAttestation(address(vault), index, keccak256("proof"));
    }

    // (a) no release below M-of-N
    function test_NoReleaseBelowThreshold() public {
        _fund(100e6);
        _define();
        vm.prank(a1);
        mgr.submitAttestation(address(vault), 0, keccak256("p"));
        vm.expectRevert(MilestoneManager.MilestoneNotVerified.selector);
        mgr.release(address(vault), 0);
        assertEq(vault.getBalance(), 100e6);
    }

    // (b) release at M-of-N (small amount: no council)
    function test_ReleaseAtThresholdBelowLimit() public {
        _fund(100e6);
        _define();
        _attest(0, a1, a2);
        mgr.release(address(vault), 0);
        assertEq(token.balanceOf(organizer), 40e6);
        assertEq(vault.getBalance(), 60e6);
        assertEq(mgr.releasedTotal(address(vault)), 40e6);
    }

    // (c) duplicate attestor is not double counted
    function test_DuplicateAttestorNotDoubleCounted() public {
        _fund(100e6);
        _define();
        vm.startPrank(a1);
        mgr.submitAttestation(address(vault), 0, keccak256("p"));
        vm.expectRevert(MilestoneManager.AlreadyAttested.selector);
        mgr.submitAttestation(address(vault), 0, keccak256("p"));
        vm.stopPrank();
        assertEq(mgr.getMilestone(address(vault), 0).attestationCount, 1);
    }

    function test_LargeReleaseNeedsCouncil() public {
        _fund(1000e6);
        _define(); // 400 mINR first tranche, above the 100 limit
        _attest(0, a1, a2);
        vm.expectRevert(abi.encodeWithSelector(MilestoneManager.InsufficientCouncilApprovals.selector, 0, 3));
        mgr.release(address(vault), 0);

        for (uint256 i = 0; i < 2; i++) {
            vm.prank(council[i]);
            mgr.councilApprove(address(vault), 0);
        }
        vm.expectRevert(abi.encodeWithSelector(MilestoneManager.InsufficientCouncilApprovals.selector, 2, 3));
        mgr.release(address(vault), 0);

        vm.prank(council[2]);
        mgr.councilApprove(address(vault), 0);
        mgr.release(address(vault), 0);
        assertEq(token.balanceOf(organizer), 400e6);
    }

    function test_CouncilMemberCannotApproveTwice() public {
        _fund(1000e6);
        _define();
        _attest(0, a1, a2);
        vm.startPrank(council[0]);
        mgr.councilApprove(address(vault), 0);
        vm.expectRevert(MilestoneManager.AlreadyApproved.selector);
        mgr.councilApprove(address(vault), 0);
        vm.stopPrank();
    }

    function test_CouncilCannotApproveBeforeVerified() public {
        _define();
        vm.prank(council[0]);
        vm.expectRevert(MilestoneManager.MilestoneNotVerified.selector);
        mgr.councilApprove(address(vault), 0);
    }

    function test_LateDonationsAreSharedProportionally() public {
        mgr.setAutoReleaseLimit(200e6); // keep both payouts below the council limit
        _fund(100e6);
        _define();
        _attest(0, a1, a2);
        mgr.release(address(vault), 0); // 40 of 100
        _fund(50e6); // raised 150 in total
        _attest(1, a1, a3);
        mgr.release(address(vault), 1); // entitled 150 - already paid 40 = 110
        assertEq(token.balanceOf(organizer), 150e6);
        assertEq(vault.getBalance(), 0);
    }

    function test_CannotReleaseTwice() public {
        _fund(100e6);
        _define();
        _attest(0, a1, a2);
        mgr.release(address(vault), 0);
        vm.expectRevert(MilestoneManager.MilestoneAlreadyReleased.selector);
        mgr.release(address(vault), 0);
    }

    function test_MustReleaseInOrder() public {
        _fund(100e6);
        _define();
        _attest(1, a1, a2);
        vm.expectRevert(abi.encodeWithSelector(MilestoneManager.OutOfOrder.selector, 0));
        mgr.release(address(vault), 1);
    }

    function test_CannotReleaseUntilMilestonesTotal100() public {
        _fund(100e6);
        vm.prank(organizer);
        mgr.defineMilestone(address(vault), 40, 2);
        _attest(0, a1, a2);
        vm.expectRevert(abi.encodeWithSelector(MilestoneManager.MilestonesNotFullyDefined.selector, 40));
        mgr.release(address(vault), 0);
    }

    function test_OnlyOrganizerDefinesAndTotalCapped() public {
        vm.expectRevert(MilestoneManager.NotVaultOrganizer.selector);
        mgr.defineMilestone(address(vault), 50, 2);

        vm.startPrank(organizer);
        mgr.defineMilestone(address(vault), 70, 2);
        vm.expectRevert(abi.encodeWithSelector(MilestoneManager.TargetPctExceeds100.selector, 110));
        mgr.defineMilestone(address(vault), 40, 2);
        vm.stopPrank();
    }

    function test_SingleAttestorMilestoneRejected() public {
        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(MilestoneManager.InvalidRequiredAttestations.selector, 1));
        mgr.defineMilestone(address(vault), 100, 1);
    }

    function test_VaultBoundToOtherManagerRejected() public {
        CampaignVault other = new CampaignVault(address(token), organizer, address(0xBEEF));
        vm.prank(organizer);
        vm.expectRevert(MilestoneManager.VaultNotBoundToThisManager.selector);
        mgr.defineMilestone(address(other), 100, 2);
    }

    function test_NonAttestorAndOrganizerCannotAttest() public {
        _define();
        vm.prank(address(0xBAD));
        vm.expectRevert(MilestoneManager.NotAttestor.selector);
        mgr.submitAttestation(address(vault), 0, bytes32(0));

        mgr.setAttestor(organizer, true);
        vm.prank(organizer);
        vm.expectRevert(MilestoneManager.OrganizerCannotAttest.selector);
        mgr.submitAttestation(address(vault), 0, bytes32(0));
    }

    function test_NonCouncilCannotApprove() public {
        _fund(1000e6);
        _define();
        _attest(0, a1, a2);
        vm.prank(address(0xBAD));
        vm.expectRevert(MilestoneManager.NotCouncilMember.selector);
        mgr.councilApprove(address(vault), 0);
    }

    function test_LimitChangeDoesNotAffectDefinedMilestones() public {
        _fund(1000e6);
        _define(); // snapshot limit = 100
        mgr.setAutoReleaseLimit(type(uint256).max); // owner tries to bypass the council
        _attest(0, a1, a2);
        vm.expectRevert(abi.encodeWithSelector(MilestoneManager.InsufficientCouncilApprovals.selector, 0, 3));
        mgr.release(address(vault), 0);
    }

    function test_OnlyOwnerManagesRoles() public {
        vm.startPrank(address(0xBAD));
        vm.expectRevert();
        mgr.setAttestor(address(0x1), true);
        vm.expectRevert();
        mgr.setCouncilMember(address(0x1), true);
        vm.expectRevert();
        mgr.setCouncilThreshold(5);
        vm.expectRevert();
        mgr.setAutoReleaseLimit(1);
        vm.stopPrank();
    }

    function test_CouncilThresholdMinimumTwo() public {
        vm.expectRevert(abi.encodeWithSelector(MilestoneManager.InvalidCouncilThreshold.selector, 1));
        mgr.setCouncilThreshold(1);
    }

    function test_ReleaseEmitsEvent() public {
        _fund(100e6);
        _define();
        _attest(0, a1, a2);
        vm.expectEmit(true, true, true, true);
        emit MilestoneManager.MilestoneReleased(address(vault), 0, organizer, 40e6);
        mgr.release(address(vault), 0);
    }

    function test_PausedVaultBlocksReleaseAndKeepsStateClean() public {
        _fund(100e6);
        _define();
        _attest(0, a1, a2);
        vm.prank(organizer);
        vault.pause("test");
        vm.expectRevert();
        mgr.release(address(vault), 0);
        assertEq(uint256(mgr.getMilestone(address(vault), 0).status), uint256(MilestoneManager.Status.Verified));
        vm.prank(organizer);
        vault.unpause();
        mgr.release(address(vault), 0);
    }

    /// @notice Whatever is raised and however it is split, payouts never exceed what was raised.
    function testFuzz_NeverPaysMoreThanRaised(uint96 first, uint96 second, uint8 pct) public {
        pct = uint8(bound(pct, 1, 99));
        first = uint96(bound(first, 1e6, 1e12));
        second = uint96(bound(second, 0, 1e12));
        _fund(first);
        vm.startPrank(organizer);
        mgr.defineMilestone(address(vault), pct, 2);
        mgr.defineMilestone(address(vault), 100 - pct, 2);
        vm.stopPrank();
        mgr.setCouncilThreshold(2);
        _attest(0, a1, a2);
        for (uint256 i = 0; i < 2; i++) {
            vm.prank(council[i]);
            mgr.councilApprove(address(vault), 0);
        }
        try mgr.release(address(vault), 0) {} catch {}
        if (second > 0) _fund(second);
        _attest(1, a1, a2);
        for (uint256 i = 0; i < 2; i++) {
            vm.prank(council[i]);
            mgr.councilApprove(address(vault), 1);
        }
        try mgr.release(address(vault), 1) {} catch {}

        uint256 raised = uint256(first) + uint256(second);
        assertLe(token.balanceOf(organizer), raised);
        assertEq(token.balanceOf(organizer) + vault.getBalance(), raised);
    }
}
