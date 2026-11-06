// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockINR} from "../src/MockINR.sol";
import {CampaignVault} from "../src/CampaignVault.sol";
import {MilestoneManager} from "../src/MilestoneManager.sol";
import {BeneficiaryRegistryV2} from "../src/BeneficiaryRegistryV2.sol";

/// @title BeneficiaryRegistryV2Test
/// @notice Tests for BeneficiaryRegistryV2: registration behaves exactly like the first registry, and
///         on top of it only a manager-registered attestor (never the vault's organizer) can confirm a
///         registered beneficiary, once each; a beneficiary is verified at `requiredAttestations`
///         distinct confirmations; and the constructor refuses a zero manager or a zero requirement.
/// @dev Includes fuzz tests: the count never exceeds the number of distinct attestors, and
///      verification flips exactly at the required number.
contract BeneficiaryRegistryV2Test is Test {
    MockINR token;
    MilestoneManager mgr;
    BeneficiaryRegistryV2 reg;
    BeneficiaryRegistryV2 reg2; // requires 2 attestations
    CampaignVault vault;
    CampaignVault otherVault;

    address organizer = address(0x0F0F);
    address otherOrganizer = address(0x0E0E);
    address a1 = address(0xA1);
    address a2 = address(0xA2);
    address a3 = address(0xA3);
    address stranger = address(0xBAD);

    bytes32 constant ID = keccak256("asha-devi|1990-01-01");
    bytes32 constant PHOTO = keccak256("photo");

    event BeneficiaryRegistered(address indexed vault, bytes32 indexed identityHash, bytes32 photoHash, uint256 index);
    event BeneficiaryAttested(address indexed vault, bytes32 indexed identityHash, address indexed attestor, uint256 count);

    function setUp() public {
        token = new MockINR();
        mgr = new MilestoneManager(100e6, 3);
        reg = new BeneficiaryRegistryV2(address(mgr), 1);
        reg2 = new BeneficiaryRegistryV2(address(mgr), 2);
        vault = new CampaignVault(address(token), organizer, address(mgr), uint64(block.timestamp + 365 days), uint64(30 days));
        otherVault = new CampaignVault(address(token), otherOrganizer, address(mgr), uint64(block.timestamp + 365 days), uint64(30 days));
        mgr.setAttestor(a1, true);
        mgr.setAttestor(a2, true);
        mgr.setAttestor(a3, true);
    }

    function _register(BeneficiaryRegistryV2 r, bytes32 id) internal {
        vm.prank(organizer);
        r.register(address(vault), id, PHOTO);
    }

    // ---- registration is unchanged

    function test_RegisterBehavesLikeTheFirstRegistry() public {
        vm.expectEmit(true, true, false, true, address(reg));
        emit BeneficiaryRegistered(address(vault), ID, PHOTO, 0);
        vm.prank(organizer);
        assertEq(reg.register(address(vault), ID, PHOTO), 0);
        assertTrue(reg.isRegistered(address(vault), ID));
        assertEq(reg.beneficiaryCount(address(vault)), 1);
    }

    function test_RegisterRefusesDuplicatesNonOrganizersAndZero() public {
        _register(reg, ID);
        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(BeneficiaryRegistryV2.DuplicateBeneficiary.selector, address(vault), ID));
        reg.register(address(vault), ID, PHOTO);

        vm.prank(stranger);
        vm.expectRevert(BeneficiaryRegistryV2.NotVaultOrganizer.selector);
        reg.register(address(vault), keccak256("x"), PHOTO);

        vm.prank(organizer);
        vm.expectRevert(BeneficiaryRegistryV2.ZeroIdentityHash.selector);
        reg.register(address(vault), bytes32(0), PHOTO);
    }

    // ---- attesting

    function test_AttestorConfirmsAndEmits() public {
        _register(reg, ID);
        assertFalse(reg.isVerified(address(vault), ID));

        vm.expectEmit(true, true, true, true, address(reg));
        emit BeneficiaryAttested(address(vault), ID, a1, 1);
        vm.prank(a1);
        reg.attestBeneficiary(address(vault), ID);

        assertEq(reg.attestationCount(address(vault), ID), 1);
        assertTrue(reg.hasAttested(address(vault), ID, a1));
        assertTrue(reg.isVerified(address(vault), ID)); // required = 1
    }

    function test_NonAttestorCannotConfirm() public {
        _register(reg, ID);
        vm.prank(stranger);
        vm.expectRevert(BeneficiaryRegistryV2.NotAttestor.selector);
        reg.attestBeneficiary(address(vault), ID);
        // the organizer is not an attestor either
        vm.prank(organizer);
        vm.expectRevert(BeneficiaryRegistryV2.NotAttestor.selector);
        reg.attestBeneficiary(address(vault), ID);
        assertEq(reg.attestationCount(address(vault), ID), 0);
    }

    function test_VaultOrganizerCannotConfirmEvenIfListedAsAttestor() public {
        mgr.setAttestor(organizer, true); // a misconfiguration the registry must still survive
        _register(reg, ID);
        vm.prank(organizer);
        vm.expectRevert(BeneficiaryRegistryV2.OrganizerCannotAttest.selector);
        reg.attestBeneficiary(address(vault), ID);
        assertEq(reg.attestationCount(address(vault), ID), 0);
    }

    function test_AnotherCampaignsOrganizerMayAttest() public {
        mgr.setAttestor(otherOrganizer, true);
        _register(reg, ID);
        vm.prank(otherOrganizer);
        reg.attestBeneficiary(address(vault), ID); // not THIS vault's organizer
        assertEq(reg.attestationCount(address(vault), ID), 1);
    }

    function test_CannotConfirmAnUnregisteredBeneficiary() public {
        vm.prank(a1);
        vm.expectRevert(abi.encodeWithSelector(BeneficiaryRegistryV2.BeneficiaryNotRegistered.selector, address(vault), ID));
        reg.attestBeneficiary(address(vault), ID);
    }

    function test_RegistrationInAnotherVaultDoesNotCount() public {
        vm.prank(otherOrganizer);
        reg.register(address(otherVault), ID, PHOTO);
        vm.prank(a1);
        vm.expectRevert(abi.encodeWithSelector(BeneficiaryRegistryV2.BeneficiaryNotRegistered.selector, address(vault), ID));
        reg.attestBeneficiary(address(vault), ID);
    }

    function test_EachAttestorCountsOnce() public {
        _register(reg2, ID);
        vm.startPrank(a1);
        reg2.attestBeneficiary(address(vault), ID);
        vm.expectRevert(BeneficiaryRegistryV2.AlreadyAttested.selector);
        reg2.attestBeneficiary(address(vault), ID);
        vm.stopPrank();
        assertEq(reg2.attestationCount(address(vault), ID), 1);
    }

    function test_VerifiedOnlyAtTheRequiredNumber() public {
        _register(reg2, ID);
        assertFalse(reg2.isVerified(address(vault), ID));
        vm.prank(a1);
        reg2.attestBeneficiary(address(vault), ID);
        assertFalse(reg2.isVerified(address(vault), ID)); // 1 of 2
        vm.prank(a2);
        reg2.attestBeneficiary(address(vault), ID);
        assertTrue(reg2.isVerified(address(vault), ID)); // 2 of 2
        vm.prank(a3);
        reg2.attestBeneficiary(address(vault), ID);
        assertTrue(reg2.isVerified(address(vault), ID)); // stays verified
        assertEq(reg2.attestationCount(address(vault), ID), 3);
    }

    function test_ARevokedAttestorCannotConfirmButEarlierConfirmationsStand() public {
        _register(reg2, ID);
        vm.prank(a1);
        reg2.attestBeneficiary(address(vault), ID);
        mgr.setAttestor(a1, false);
        vm.prank(a1);
        vm.expectRevert(BeneficiaryRegistryV2.NotAttestor.selector);
        reg2.attestBeneficiary(address(vault), keccak256("other"));
        assertEq(reg2.attestationCount(address(vault), ID), 1);
    }

    function test_AttestationsArePerBeneficiaryAndPerVault() public {
        _register(reg, ID);
        _register(reg, keccak256("second"));
        vm.prank(a1);
        reg.attestBeneficiary(address(vault), ID);
        assertTrue(reg.isVerified(address(vault), ID));
        assertFalse(reg.isVerified(address(vault), keccak256("second")));
        assertFalse(reg.isVerified(address(otherVault), ID));
    }

    // ---- construction

    function test_ConstructorRefusesZeroManagerAndZeroRequirement() public {
        vm.expectRevert(BeneficiaryRegistryV2.ZeroAddress.selector);
        new BeneficiaryRegistryV2(address(0), 1);
        vm.expectRevert(abi.encodeWithSelector(BeneficiaryRegistryV2.InvalidRequiredAttestations.selector, 0));
        new BeneficiaryRegistryV2(address(mgr), 0);
    }

    function test_ImmutablesAreSet() public view {
        assertEq(address(reg.manager()), address(mgr));
        assertEq(reg.requiredAttestations(), 1);
        assertEq(reg2.requiredAttestations(), 2);
    }

    // ---- fuzz

    function testFuzz_CountEqualsDistinctAttestorsAndVerifiesExactlyAtTheRequirement(uint8 n, uint8 required) public {
        n = uint8(bound(n, 0, 20));
        required = uint8(bound(required, 1, 20));
        BeneficiaryRegistryV2 r = new BeneficiaryRegistryV2(address(mgr), required);
        vm.prank(organizer);
        r.register(address(vault), ID, PHOTO);

        for (uint256 i = 0; i < n; i++) {
            address att = address(uint160(0x1000 + i));
            mgr.setAttestor(att, true);
            vm.startPrank(att);
            r.attestBeneficiary(address(vault), ID);
            // a repeat by the same attestor never raises the count
            vm.expectRevert(BeneficiaryRegistryV2.AlreadyAttested.selector);
            r.attestBeneficiary(address(vault), ID);
            vm.stopPrank();
        }
        assertEq(r.attestationCount(address(vault), ID), n);
        assertEq(r.isVerified(address(vault), ID), n >= required);
    }

    function testFuzz_NobodyButAListedAttestorCanConfirm(address who) public {
        vm.assume(who != a1 && who != a2 && who != a3 && who != organizer);
        _register(reg, ID);
        vm.prank(who);
        vm.expectRevert(BeneficiaryRegistryV2.NotAttestor.selector);
        reg.attestBeneficiary(address(vault), ID);
    }
}
