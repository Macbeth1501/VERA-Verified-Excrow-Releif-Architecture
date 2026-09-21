// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockINR} from "../src/MockINR.sol";
import {CampaignVault} from "../src/CampaignVault.sol";
import {MilestoneManager} from "../src/MilestoneManager.sol";
import {BeneficiaryRegistry} from "../src/BeneficiaryRegistry.sol";

contract BeneficiaryRegistryTest is Test {
    MockINR token;
    MilestoneManager mgr;
    BeneficiaryRegistry reg;
    CampaignVault vault;
    CampaignVault otherVault;

    address organizer = address(0x0F0F);
    address otherOrganizer = address(0x0E0E);
    address attestor = address(0xA1);
    address stranger = address(0xBAD);

    bytes32 constant ID = keccak256("asha-devi|1990-01-01");
    bytes32 constant PHOTO = keccak256("photo");

    event BeneficiaryRegistered(address indexed vault, bytes32 indexed identityHash, bytes32 photoHash, uint256 index);

    function setUp() public {
        token = new MockINR();
        mgr = new MilestoneManager(100e6, 3);
        reg = new BeneficiaryRegistry();
        vault = new CampaignVault(address(token), organizer, address(mgr));
        otherVault = new CampaignVault(address(token), otherOrganizer, address(mgr));
        mgr.setAttestor(attestor, true);
    }

    function test_OrganizerRegistersAndEmits() public {
        vm.expectEmit(true, true, false, true, address(reg));
        emit BeneficiaryRegistered(address(vault), ID, PHOTO, 0);
        vm.prank(organizer);
        uint256 index = reg.register(address(vault), ID, PHOTO);

        assertEq(index, 0);
        assertTrue(reg.isRegistered(address(vault), ID));
        assertEq(reg.beneficiaryCount(address(vault)), 1);
    }

    function test_PhotoHashIsOptional() public {
        vm.prank(organizer);
        reg.register(address(vault), ID, bytes32(0));
        assertTrue(reg.isRegistered(address(vault), ID));
    }

    function test_IndexesCountUp() public {
        vm.startPrank(organizer);
        assertEq(reg.register(address(vault), keccak256("a"), 0), 0);
        assertEq(reg.register(address(vault), keccak256("b"), 0), 1);
        assertEq(reg.register(address(vault), keccak256("c"), 0), 2);
        vm.stopPrank();
        assertEq(reg.beneficiaryCount(address(vault)), 3);
    }

    // The core guarantee (FR-IDN-03): one fingerprint, one beneficiary, per campaign.
    function test_DuplicateInSameVaultReverts() public {
        vm.startPrank(organizer);
        reg.register(address(vault), ID, PHOTO);
        vm.expectRevert(abi.encodeWithSelector(BeneficiaryRegistry.DuplicateBeneficiary.selector, address(vault), ID));
        reg.register(address(vault), ID, PHOTO);
        vm.stopPrank();
        assertEq(reg.beneficiaryCount(address(vault)), 1);
    }

    function test_DuplicateWithDifferentPhotoStillReverts() public {
        vm.startPrank(organizer);
        reg.register(address(vault), ID, PHOTO);
        vm.expectRevert(abi.encodeWithSelector(BeneficiaryRegistry.DuplicateBeneficiary.selector, address(vault), ID));
        reg.register(address(vault), ID, keccak256("another photo"));
        vm.stopPrank();
    }

    // Programs are separate namespaces: the same person may be helped by two campaigns.
    function test_SameHashInDifferentVaultSucceeds() public {
        vm.prank(organizer);
        reg.register(address(vault), ID, 0);
        vm.prank(otherOrganizer);
        reg.register(address(otherVault), ID, 0);

        assertTrue(reg.isRegistered(address(vault), ID));
        assertTrue(reg.isRegistered(address(otherVault), ID));
    }

    function test_OrganizerCannotRegisterIntoAnotherCampaign() public {
        vm.prank(organizer);
        vm.expectRevert(BeneficiaryRegistry.NotVaultOrganizer.selector);
        reg.register(address(otherVault), ID, 0);
    }

    function test_StrangerCannotRegister() public {
        vm.prank(stranger);
        vm.expectRevert(BeneficiaryRegistry.NotVaultOrganizer.selector);
        reg.register(address(vault), ID, 0);
        assertFalse(reg.isRegistered(address(vault), ID));
    }

    function test_AttestorAndManagerOwnerCannotRegister() public {
        vm.prank(attestor);
        vm.expectRevert(BeneficiaryRegistry.NotVaultOrganizer.selector);
        reg.register(address(vault), ID, 0);
        // This test contract owns the manager; owning it grants nothing here.
        vm.expectRevert(BeneficiaryRegistry.NotVaultOrganizer.selector);
        reg.register(address(vault), ID, 0);
    }

    function test_ZeroIdentityHashReverts() public {
        vm.prank(organizer);
        vm.expectRevert(BeneficiaryRegistry.ZeroIdentityHash.selector);
        reg.register(address(vault), bytes32(0), 0);
    }

    function test_NonVaultAddressReverts() public {
        vm.prank(organizer);
        vm.expectRevert();
        reg.register(address(0xDEAD), ID, 0);
    }

    function testFuzz_DistinctHashesAllRegisterAndCount(uint8 n, bytes32 seed) public {
        uint256 count = uint256(n) % 40;
        vm.startPrank(organizer);
        for (uint256 i = 0; i < count; i++) {
            bytes32 h = keccak256(abi.encode(seed, i));
            reg.register(address(vault), h, 0);
            assertTrue(reg.isRegistered(address(vault), h));
        }
        vm.stopPrank();
        assertEq(reg.beneficiaryCount(address(vault)), count);
    }

    // No hash can ever be counted twice, whatever the sequence of attempts.
    function testFuzz_RepeatsNeverIncreaseCount(bytes32 h) public {
        vm.assume(h != bytes32(0));
        vm.startPrank(organizer);
        reg.register(address(vault), h, 0);
        for (uint256 i = 0; i < 3; i++) {
            vm.expectRevert(abi.encodeWithSelector(BeneficiaryRegistry.DuplicateBeneficiary.selector, address(vault), h));
            reg.register(address(vault), h, 0);
        }
        vm.stopPrank();
        assertEq(reg.beneficiaryCount(address(vault)), 1);
    }
}
