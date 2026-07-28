// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";
import {CampaignVault} from "../src/CampaignVault.sol";
import {MockINR} from "../src/MockINR.sol";

/// @title CampaignFactoryTest
/// @notice Covers FR-CMP-01 acceptance criteria (SPDD §5.2): milestones must sum to exactly
///         100%, admin cap must not exceed the category ceiling, and only verified organizers
///         may create campaigns. Also covers the Implementation Roadmap Sub-step 3.5 fuzz
///         requirement on deposit() through a factory-created vault (SPDD §21).
contract CampaignFactoryTest is Test {
    /// @dev Mirrors CampaignFactory.CampaignCreated's exact signature so vm.expectEmit's
    ///      topic0 hash matches the real event emitted by the Factory.
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed organizer,
        address indexed vault,
        CampaignFactory.CampaignCategory category,
        uint256 fundingGoal
    );

    MockINR internal token;
    CampaignFactory internal factory;

    address internal organizer;
    address internal donor;

    function setUp() public {
        token = new MockINR();
        factory = new CampaignFactory(address(token));
        organizer = makeAddr("organizer");
        donor = makeAddr("donor");
    }

    // ---------------------------------------------------------------------
    // Happy path
    // ---------------------------------------------------------------------

    function test_HappyPath_CreateCampaignAndDeposit() public {
        factory.setOrganizerVerified(organizer, true);
        CampaignFactory.MilestoneInput[] memory milestones = _milestones60_40();

        vm.prank(organizer);
        (uint256 campaignId, address vault) = factory.createCampaign(
            CampaignFactory.CampaignCategory.DISASTER_RELIEF,
            1_000e6,
            milestones,
            10
        );

        assertEq(campaignId, 0);
        assertTrue(vault != address(0));
        assertEq(factory.campaignCount(), 1);

        uint256[] memory organizerCampaigns = factory.getCampaignsByOrganizer(organizer);
        assertEq(organizerCampaigns.length, 1);
        assertEq(organizerCampaigns[0], campaignId);

        CampaignFactory.CampaignRecord memory record = factory.getCampaign(campaignId);
        assertEq(record.vault, vault);
        assertEq(record.organizer, organizer);
        assertEq(uint256(record.category), uint256(CampaignFactory.CampaignCategory.DISASTER_RELIEF));
        assertEq(record.fundingGoal, 1_000e6);
        assertEq(record.adminCapPct, 10);

        uint256 depositAmount = 250e6;
        token.mint(donor, depositAmount);

        vm.prank(donor);
        token.approve(vault, depositAmount);

        vm.prank(donor);
        CampaignVault(vault).deposit(depositAmount);

        assertEq(CampaignVault(vault).getBalance(), depositAmount);
        assertEq(token.balanceOf(vault), depositAmount);
    }

    function test_HappyPath_EmitsCampaignCreatedEvent() public {
        factory.setOrganizerVerified(organizer, true);
        CampaignFactory.MilestoneInput[] memory milestones = _milestones60_40();

        vm.expectEmit(true, true, false, true, address(factory));
        emit CampaignCreated(0, organizer, address(0), CampaignFactory.CampaignCategory.DISASTER_RELIEF, 1_000e6);

        vm.prank(organizer);
        factory.createCampaign(CampaignFactory.CampaignCategory.DISASTER_RELIEF, 1_000e6, milestones, 10);
    }

    // ---------------------------------------------------------------------
    // Revert paths
    // ---------------------------------------------------------------------

    function test_Revert_UnverifiedOrganizer() public {
        CampaignFactory.MilestoneInput[] memory milestones = _milestones60_40();

        vm.expectRevert(abi.encodeWithSelector(CampaignFactory.OrganizerNotVerified.selector, organizer));
        vm.prank(organizer);
        factory.createCampaign(CampaignFactory.CampaignCategory.DISASTER_RELIEF, 1_000e6, milestones, 10);
    }

    function test_Revert_AdminCapExceeded() public {
        factory.setOrganizerVerified(organizer, true);
        CampaignFactory.MilestoneInput[] memory milestones = _milestones60_40();

        vm.expectRevert(abi.encodeWithSelector(CampaignFactory.AdminCapExceeded.selector, 11, 10));
        vm.prank(organizer);
        factory.createCampaign(CampaignFactory.CampaignCategory.DISASTER_RELIEF, 1_000e6, milestones, 11);
    }

    function test_Revert_MilestonesUnder100() public {
        factory.setOrganizerVerified(organizer, true);
        CampaignFactory.MilestoneInput[] memory milestones = new CampaignFactory.MilestoneInput[](2);
        milestones[0].targetPct = 50;
        milestones[1].targetPct = 40;

        vm.expectRevert(abi.encodeWithSelector(CampaignFactory.MilestonesDoNotSumTo100.selector, 90));
        vm.prank(organizer);
        factory.createCampaign(CampaignFactory.CampaignCategory.DISASTER_RELIEF, 1_000e6, milestones, 10);
    }

    function test_Revert_MilestonesOver100() public {
        factory.setOrganizerVerified(organizer, true);
        CampaignFactory.MilestoneInput[] memory milestones = new CampaignFactory.MilestoneInput[](2);
        milestones[0].targetPct = 60;
        milestones[1].targetPct = 50;

        vm.expectRevert(abi.encodeWithSelector(CampaignFactory.MilestonesDoNotSumTo100.selector, 110));
        vm.prank(organizer);
        factory.createCampaign(CampaignFactory.CampaignCategory.DISASTER_RELIEF, 1_000e6, milestones, 10);
    }

    function test_Revert_NoMilestones() public {
        factory.setOrganizerVerified(organizer, true);
        CampaignFactory.MilestoneInput[] memory milestones = new CampaignFactory.MilestoneInput[](0);

        vm.expectRevert(CampaignFactory.NoMilestones.selector);
        vm.prank(organizer);
        factory.createCampaign(CampaignFactory.CampaignCategory.DISASTER_RELIEF, 1_000e6, milestones, 10);
    }

    // ---------------------------------------------------------------------
    // Fuzz: deposit() through a factory-created vault (SPDD §21)
    // ---------------------------------------------------------------------

    function testFuzz_DepositThroughFactoryVault(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        factory.setOrganizerVerified(organizer, true);
        CampaignFactory.MilestoneInput[] memory milestones = _milestones60_40();

        vm.prank(organizer);
        (, address vault) = factory.createCampaign(
            CampaignFactory.CampaignCategory.DISASTER_RELIEF,
            1_000e6,
            milestones,
            10
        );

        token.mint(donor, amount);

        vm.prank(donor);
        token.approve(vault, amount);

        vm.prank(donor);
        CampaignVault(vault).deposit(amount);

        assertEq(CampaignVault(vault).getBalance(), amount);
        assertEq(token.balanceOf(vault), amount);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    function _milestones60_40() internal pure returns (CampaignFactory.MilestoneInput[] memory) {
        CampaignFactory.MilestoneInput[] memory milestones = new CampaignFactory.MilestoneInput[](2);
        milestones[0].targetPct = 60;
        milestones[1].targetPct = 40;
        return milestones;
    }
}
