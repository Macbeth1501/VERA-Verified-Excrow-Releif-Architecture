// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockINR} from "../src/MockINR.sol";
import {CampaignVault} from "../src/CampaignVault.sol";
import {MilestoneManager} from "../src/MilestoneManager.sol";
import {BeneficiaryRegistryV2} from "../src/BeneficiaryRegistryV2.sol";
import {DisbursementV2} from "../src/DisbursementV2.sol";

/// @title DisbursementV2Test
/// @notice Tests for DisbursementV2: the rules of the first Disbursement still hold (organizer only,
///         released milestone, paid once, within what was released, bound manager, no zero amount or
///         reference), and the new one: a payout to a beneficiary who is registered but not yet
///         verified by an attestor reverts `BeneficiaryNotVerified` and moves no money.
/// @dev Includes a fuzz test that payouts never exceed the released amount.
contract DisbursementV2Test is Test {
    MockINR token;
    MilestoneManager mgr;
    BeneficiaryRegistryV2 reg;
    DisbursementV2 dis;
    CampaignVault vault;

    address organizer = address(0x0F0F);
    address donor = address(0xD0);
    address stranger = address(0xBAD);
    address a1 = address(0xA1);
    address a2 = address(0xA2);
    address a3 = address(0xA3);
    address[3] council = [address(0xC1), address(0xC2), address(0xC3)];

    bytes32 constant ID = keccak256("beneficiary-one");
    bytes32 constant GHOST = keccak256("registered-but-never-met");
    bytes32 constant REF = keccak256("offramp-reference");
    uint256 constant LIMIT = 100e6;

    event PayoutRecorded(
        address indexed vault,
        uint256 indexed milestoneIndex,
        bytes32 indexed identityHash,
        uint256 amount,
        bytes32 payoutRef,
        address organizer
    );

    function setUp() public {
        token = new MockINR();
        mgr = new MilestoneManager(LIMIT, 3);
        reg = new BeneficiaryRegistryV2(address(mgr), 1);
        dis = new DisbursementV2(address(token), address(mgr), address(reg));
        vault = new CampaignVault(address(token), organizer, address(mgr), uint64(block.timestamp + 365 days), uint64(30 days));

        mgr.setAttestor(a1, true);
        mgr.setAttestor(a2, true);
        mgr.setAttestor(a3, true);
        for (uint256 i = 0; i < 3; i++) mgr.setCouncilMember(council[i], true);

        vm.startPrank(organizer);
        reg.register(address(vault), ID, 0);
        reg.register(address(vault), GHOST, 0);
        vm.stopPrank();
        vm.prank(a3);
        reg.attestBeneficiary(address(vault), ID); // ID is verified; GHOST is only registered
    }

    function _fund(uint256 amount) internal {
        token.mint(donor, amount);
        vm.startPrank(donor);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function _release0() internal returns (uint256) {
        _fund(250e6);
        vm.startPrank(organizer);
        mgr.defineMilestone(address(vault), 60, 2);
        mgr.defineMilestone(address(vault), 40, 2);
        vm.stopPrank();
        vm.prank(a1);
        mgr.submitAttestation(address(vault), 0, keccak256("p"));
        vm.prank(a2);
        mgr.submitAttestation(address(vault), 0, keccak256("p"));
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(council[i]);
            mgr.councilApprove(address(vault), 0);
        }
        mgr.release(address(vault), 0);
        return 150e6;
    }

    function _allow(uint256 amount) internal {
        vm.prank(organizer);
        token.approve(address(dis), amount);
    }

    function test_RecordsPayoutToAVerifiedBeneficiary() public {
        uint256 amount = _release0();
        _allow(amount);

        vm.expectEmit(true, true, true, true, address(dis));
        emit PayoutRecorded(address(vault), 0, ID, amount, REF, organizer);
        vm.prank(organizer);
        dis.disburse(address(vault), 0, ID, amount, REF);

        assertTrue(dis.isDisbursed(address(vault), 0));
        assertEq(dis.disbursedTotal(address(vault)), amount);
        assertEq(token.balanceOf(address(dis)), amount);
        assertEq(token.balanceOf(organizer), 0);
    }

    // The new rule: registered is not enough.
    function test_RefusesARegisteredButUnverifiedBeneficiaryAndMovesNothing() public {
        uint256 amount = _release0();
        _allow(amount);
        vm.prank(organizer);
        vm.expectRevert(DisbursementV2.BeneficiaryNotVerified.selector);
        dis.disburse(address(vault), 0, GHOST, amount, REF);

        assertFalse(dis.isDisbursed(address(vault), 0));
        assertEq(dis.disbursedTotal(address(vault)), 0);
        assertEq(token.balanceOf(organizer), amount);
        assertEq(token.balanceOf(address(dis)), 0);
    }

    function test_RefusesAnUnregisteredFingerprint() public {
        uint256 amount = _release0();
        _allow(amount);
        vm.prank(organizer);
        vm.expectRevert(DisbursementV2.BeneficiaryNotVerified.selector);
        dis.disburse(address(vault), 0, keccak256("nobody"), amount, REF);
    }

    function test_AllowsThePayoutOnceTheGhostIsConfirmed() public {
        uint256 amount = _release0();
        _allow(amount);
        vm.prank(a1);
        reg.attestBeneficiary(address(vault), GHOST);
        vm.prank(organizer);
        dis.disburse(address(vault), 0, GHOST, amount, REF);
        assertEq(dis.disbursedTotal(address(vault)), amount);
    }

    function test_AStricterRegistryNeedsTwoAttestors() public {
        BeneficiaryRegistryV2 strict = new BeneficiaryRegistryV2(address(mgr), 2);
        DisbursementV2 strictDis = new DisbursementV2(address(token), address(mgr), address(strict));
        vm.prank(organizer);
        strict.register(address(vault), ID, 0);
        uint256 amount = _release0();
        vm.prank(organizer);
        token.approve(address(strictDis), amount);

        vm.prank(a1);
        strict.attestBeneficiary(address(vault), ID);
        vm.prank(organizer);
        vm.expectRevert(DisbursementV2.BeneficiaryNotVerified.selector);
        strictDis.disburse(address(vault), 0, ID, amount, REF); // 1 of 2

        vm.prank(a2);
        strict.attestBeneficiary(address(vault), ID);
        vm.prank(organizer);
        strictDis.disburse(address(vault), 0, ID, amount, REF); // 2 of 2
        assertEq(strictDis.disbursedTotal(address(vault)), amount);
    }

    // ---- the first contract's rules still hold

    function test_OnlyTheVaultsOrganizerCanDisburse() public {
        uint256 amount = _release0();
        vm.prank(stranger);
        vm.expectRevert(DisbursementV2.NotVaultOrganizer.selector);
        dis.disburse(address(vault), 0, ID, amount, REF);
    }

    function test_RefusesAnUnreleasedMilestone() public {
        _release0();
        _allow(1e6);
        vm.prank(organizer);
        vm.expectRevert(DisbursementV2.MilestoneNotReleased.selector);
        dis.disburse(address(vault), 1, ID, 1e6, REF);
    }

    function test_RefusesDoubleDisbursementZeroAmountAndMissingReference() public {
        uint256 amount = _release0();
        _allow(amount);
        vm.startPrank(organizer);
        vm.expectRevert(DisbursementV2.ZeroAmount.selector);
        dis.disburse(address(vault), 0, ID, 0, REF);
        vm.expectRevert(DisbursementV2.MissingPayoutReference.selector);
        dis.disburse(address(vault), 0, ID, 1e6, bytes32(0));
        dis.disburse(address(vault), 0, ID, 50e6, REF);
        vm.expectRevert(DisbursementV2.MilestoneAlreadyDisbursed.selector);
        dis.disburse(address(vault), 0, ID, 50e6, REF);
        vm.stopPrank();
    }

    function test_RefusesMoreThanWasReleased() public {
        uint256 amount = _release0();
        _allow(amount + 1);
        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(DisbursementV2.ExceedsReleased.selector, amount + 1, amount));
        dis.disburse(address(vault), 0, ID, amount + 1, REF);
    }

    function test_RefusesAVaultBoundToAnotherManager() public {
        MilestoneManager other = new MilestoneManager(LIMIT, 3);
        CampaignVault foreign = new CampaignVault(address(token), organizer, address(other), uint64(block.timestamp + 365 days), uint64(30 days));
        vm.prank(organizer);
        vm.expectRevert(DisbursementV2.VaultNotBoundToThisManager.selector);
        dis.disburse(address(foreign), 0, ID, 1e6, REF);
    }

    function test_ConstructorRefusesZeroAddresses() public {
        vm.expectRevert(DisbursementV2.ZeroAddress.selector);
        new DisbursementV2(address(0), address(mgr), address(reg));
        vm.expectRevert(DisbursementV2.ZeroAddress.selector);
        new DisbursementV2(address(token), address(0), address(reg));
        vm.expectRevert(DisbursementV2.ZeroAddress.selector);
        new DisbursementV2(address(token), address(mgr), address(0));
    }

    function testFuzz_PayoutsNeverExceedWhatWasReleased(uint256 first, uint256 second) public {
        uint256 released = _release0();
        first = bound(first, 1, released);
        _allow(released);
        vm.prank(organizer);
        dis.disburse(address(vault), 0, ID, first, REF);
        assertLe(dis.disbursedTotal(address(vault)), released);

        // a second milestone is not released, so nothing more can be recorded against it
        second = bound(second, 1, released);
        vm.prank(organizer);
        vm.expectRevert(DisbursementV2.MilestoneNotReleased.selector);
        dis.disburse(address(vault), 1, ID, second, REF);
    }
}
