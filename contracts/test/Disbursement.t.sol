// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockINR} from "../src/MockINR.sol";
import {CampaignVault} from "../src/CampaignVault.sol";
import {MilestoneManager} from "../src/MilestoneManager.sol";
import {BeneficiaryRegistry} from "../src/BeneficiaryRegistry.sol";
import {Disbursement} from "../src/Disbursement.sol";

contract DisbursementTest is Test {
    MockINR token;
    MilestoneManager mgr;
    BeneficiaryRegistry reg;
    Disbursement dis;
    CampaignVault vault;

    address organizer = address(0x0F0F);
    address donor = address(0xD0);
    address stranger = address(0xBAD);
    address a1 = address(0xA1);
    address a2 = address(0xA2);
    address[3] council = [address(0xC1), address(0xC2), address(0xC3)];

    bytes32 constant ID = keccak256("beneficiary-one");
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
        reg = new BeneficiaryRegistry();
        dis = new Disbursement(address(token), address(mgr), address(reg));
        vault = new CampaignVault(address(token), organizer, address(mgr));

        mgr.setAttestor(a1, true);
        mgr.setAttestor(a2, true);
        for (uint256 i = 0; i < 3; i++) mgr.setCouncilMember(council[i], true);

        vm.prank(organizer);
        reg.register(address(vault), ID, 0);
    }

    function _fund(uint256 amount) internal {
        token.mint(donor, amount);
        vm.startPrank(donor);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    /// @dev Two milestones (60/40), each needing 2 attestors.
    function _define() internal {
        vm.startPrank(organizer);
        mgr.defineMilestone(address(vault), 60, 2);
        mgr.defineMilestone(address(vault), 40, 2);
        vm.stopPrank();
    }

    function _verify(uint256 index) internal {
        vm.prank(a1);
        mgr.submitAttestation(address(vault), index, keccak256("p"));
        vm.prank(a2);
        mgr.submitAttestation(address(vault), index, keccak256("p"));
    }

    function _approveCouncil(uint256 index) internal {
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(council[i]);
            mgr.councilApprove(address(vault), index);
        }
    }

    /// @dev Raises 250, releases milestone 0 (60% = 150) to the organizer. Returns the amount.
    function _release0() internal returns (uint256) {
        _fund(250e6);
        _define();
        _verify(0);
        _approveCouncil(0); // 150 is above the 100 auto-release limit
        mgr.release(address(vault), 0);
        return 150e6;
    }

    function _allow(uint256 amount) internal {
        vm.prank(organizer);
        token.approve(address(dis), amount);
    }

    function test_RecordsPayoutAndMovesTheMoney() public {
        uint256 amount = _release0();
        _allow(amount);

        vm.expectEmit(true, true, true, true, address(dis));
        emit PayoutRecorded(address(vault), 0, ID, amount, REF, organizer);
        vm.prank(organizer);
        dis.disburse(address(vault), 0, ID, amount, REF);

        assertEq(token.balanceOf(address(dis)), amount);
        assertEq(token.balanceOf(organizer), 0);
        assertEq(dis.disbursedTotal(address(vault)), amount);
        assertTrue(dis.isDisbursed(address(vault), 0));
        assertEq(dis.payableRemaining(address(vault)), 0);
    }

    function test_PartialPayoutLeavesTheRestPayable() public {
        uint256 amount = _release0();
        _allow(amount);
        vm.prank(organizer);
        dis.disburse(address(vault), 0, ID, 50e6, REF);

        assertEq(dis.payableRemaining(address(vault)), amount - 50e6);
        assertEq(token.balanceOf(organizer), amount - 50e6);
    }

    // FR-ESC-02: an unverified milestone can never be paid out.
    function test_UnreleasedMilestoneReverts() public {
        _release0();
        _allow(40e6);
        vm.prank(organizer);
        vm.expectRevert(Disbursement.MilestoneNotReleased.selector);
        dis.disburse(address(vault), 1, ID, 40e6, REF); // milestone 1 is still Pending
    }

    function test_VerifiedButUnreleasedMilestoneReverts() public {
        _fund(250e6);
        _define();
        _verify(0); // Verified, never released
        _allow(10e6);
        vm.prank(organizer);
        vm.expectRevert(Disbursement.MilestoneNotReleased.selector);
        dis.disburse(address(vault), 0, ID, 10e6, REF);
    }

    // FR-ESC-02: an already-paid milestone can never be paid twice.
    function test_AlreadyDisbursedMilestoneReverts() public {
        uint256 amount = _release0();
        _allow(amount);
        vm.startPrank(organizer);
        dis.disburse(address(vault), 0, ID, 100e6, REF);
        vm.expectRevert(Disbursement.MilestoneAlreadyDisbursed.selector);
        dis.disburse(address(vault), 0, ID, 50e6, REF);
        vm.stopPrank();
        assertEq(dis.disbursedTotal(address(vault)), 100e6);
    }

    function test_UnregisteredBeneficiaryReverts() public {
        uint256 amount = _release0();
        _allow(amount);
        vm.prank(organizer);
        vm.expectRevert(Disbursement.BeneficiaryNotRegistered.selector);
        dis.disburse(address(vault), 0, keccak256("never-registered"), amount, REF);
    }

    function test_BeneficiaryOfAnotherCampaignDoesNotCount() public {
        CampaignVault other = new CampaignVault(address(token), organizer, address(mgr));
        bytes32 elsewhereId = keccak256("registered-elsewhere");
        vm.prank(organizer);
        reg.register(address(other), elsewhereId, 0);

        uint256 amount = _release0();
        _allow(amount);
        vm.prank(organizer);
        vm.expectRevert(Disbursement.BeneficiaryNotRegistered.selector);
        dis.disburse(address(vault), 0, elsewhereId, amount, REF);
    }

    // The cap that makes the numbers reconcilable: payouts can never exceed what was released.
    function test_MoreThanReleasedReverts() public {
        uint256 amount = _release0();
        token.mint(organizer, 500e6); // plenty of tokens, but not plenty of entitlement
        _allow(amount + 1);
        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(Disbursement.ExceedsReleased.selector, amount + 1, amount));
        dis.disburse(address(vault), 0, ID, amount + 1, REF);
    }

    function test_SecondMilestoneIsPayableOnlyAfterItsOwnRelease() public {
        uint256 first = _release0();
        _allow(first);
        vm.prank(organizer);
        dis.disburse(address(vault), 0, ID, first, REF);
        assertEq(dis.payableRemaining(address(vault)), 0);

        _verify(1);
        mgr.release(address(vault), 1); // 40% of 250 = 100, at the limit, no council needed
        assertEq(dis.payableRemaining(address(vault)), 100e6);

        _allow(100e6);
        vm.prank(organizer);
        dis.disburse(address(vault), 1, ID, 100e6, REF);
        assertEq(dis.disbursedTotal(address(vault)), 250e6);
        assertEq(token.balanceOf(address(dis)), 250e6);
    }

    function test_OnlyTheVaultOrganizerCanDisburse() public {
        uint256 amount = _release0();
        vm.prank(organizer);
        token.transfer(stranger, amount);
        vm.startPrank(stranger);
        token.approve(address(dis), amount);
        vm.expectRevert(Disbursement.NotVaultOrganizer.selector);
        dis.disburse(address(vault), 0, ID, amount, REF);
        vm.stopPrank();
    }

    function test_WithoutApprovalItReverts() public {
        uint256 amount = _release0();
        vm.prank(organizer);
        vm.expectRevert();
        dis.disburse(address(vault), 0, ID, amount, REF);
        assertFalse(dis.isDisbursed(address(vault), 0));
    }

    function test_ZeroAmountAndMissingReferenceRevert() public {
        uint256 amount = _release0();
        _allow(amount);
        vm.startPrank(organizer);
        vm.expectRevert(Disbursement.ZeroAmount.selector);
        dis.disburse(address(vault), 0, ID, 0, REF);
        vm.expectRevert(Disbursement.MissingPayoutReference.selector);
        dis.disburse(address(vault), 0, ID, amount, bytes32(0));
        vm.stopPrank();
    }

    function test_VaultBoundToAnotherManagerReverts() public {
        MilestoneManager other = new MilestoneManager(LIMIT, 3);
        CampaignVault foreign = new CampaignVault(address(token), organizer, address(other));
        vm.prank(organizer);
        reg.register(address(foreign), ID, 0);
        token.mint(organizer, 10e6);
        _allow(10e6);
        vm.prank(organizer);
        vm.expectRevert(Disbursement.VaultNotBoundToThisManager.selector);
        dis.disburse(address(foreign), 0, ID, 10e6, REF);
    }

    function test_ConstructorRejectsZeroAddresses() public {
        vm.expectRevert(Disbursement.ZeroAddress.selector);
        new Disbursement(address(0), address(mgr), address(reg));
        vm.expectRevert(Disbursement.ZeroAddress.selector);
        new Disbursement(address(token), address(0), address(reg));
        vm.expectRevert(Disbursement.ZeroAddress.selector);
        new Disbursement(address(token), address(mgr), address(0));
    }

    /// @dev The invariant the public ledger depends on: however a campaign's payouts are split,
    ///      their sum never exceeds what the manager actually released.
    function testFuzz_PayoutsNeverExceedReleased(uint96 rawFirst, uint96 rawSecond) public {
        uint256 released = _release0();
        token.mint(organizer, 1_000_000e6); // never let a token shortage be what stops it
        uint256 first = uint256(rawFirst) % (released + 50e6);
        uint256 second = uint256(rawSecond) % (released + 50e6);

        _allow(first + second + 1);
        vm.startPrank(organizer);
        if (first == 0 || first > dis.payableRemaining(address(vault))) {
            vm.expectRevert();
        }
        dis.disburse(address(vault), 0, ID, first, REF);

        // Milestone 1 is not released, so this must always fail, whatever the amount.
        vm.expectRevert();
        dis.disburse(address(vault), 1, ID, second, REF);
        vm.stopPrank();

        assertLe(dis.disbursedTotal(address(vault)), mgr.releasedTotal(address(vault)));
        assertEq(token.balanceOf(address(dis)), dis.disbursedTotal(address(vault)));
    }
}
