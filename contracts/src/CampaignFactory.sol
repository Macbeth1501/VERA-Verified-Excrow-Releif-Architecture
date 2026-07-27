// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {CampaignVault} from "./CampaignVault.sol";

/// @title CampaignFactory
/// @notice Deploys a fresh CampaignVault per campaign, enforcing organizer verification,
///         admin-expense-cap ceilings, and milestone-percentage integrity on-chain.
/// @dev Ref: SPDD §18.1, FR-CMP-01, Traceability Matrix P9/P11 (§3.1).
contract CampaignFactory is Ownable {
    /// @notice Campaign category, mirroring @vera/types CampaignCategory.
    enum CampaignCategory {
        DISASTER_RELIEF,
        MEDICAL,
        COMMUNITY
    }

    /// @notice Milestone definition at creation time. Full lifecycle (attestation, release)
    ///         is owned by MilestoneManager.sol (Step 4) — the Factory only validates the
    ///         initial percentage split.
    struct MilestoneInput {
        uint256 targetPct; // in whole percent, e.g. 30 == 30%
    }

    /// @dev Category admin-expense ceilings, in whole percent. Ref: SPDD §18.3 (illustrated
    ///      there in basis points for MilestoneManager; kept in whole percent here to match
    ///      the simpler campaign-level cap check at creation time).
    mapping(CampaignCategory => uint256) public categoryAdminCeilingPct;

    /// @notice On-chain verified-organizer registry. The single source of truth the Factory
    ///         checks against — the off-chain mock-KYB admin-approval flow (Step 6) calls
    ///         `setOrganizerVerified` via a transaction, so on-chain and off-chain status
    ///         are the same action, never two systems that can drift.
    mapping(address => bool) public isVerifiedOrganizer;

    /// @notice The mINR token address every deployed vault will use.
    address public immutable mockToken;

    struct CampaignRecord {
        address vault;
        address organizer;
        CampaignCategory category;
        uint256 fundingGoal;
        uint256 adminCapPct;
    }

    CampaignRecord[] private _campaigns;
    mapping(address => uint256[]) private _campaignIndexesByOrganizer;

    event OrganizerVerifiedSet(address indexed organizer, bool verified);
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed organizer,
        address indexed vault,
        CampaignCategory category,
        uint256 fundingGoal
    );

    error OrganizerNotVerified(address organizer);
    error AdminCapExceeded(uint256 requestedPct, uint256 ceilingPct);
    error MilestonesDoNotSumTo100(uint256 actualSum);
    error NoMilestones();

    constructor(address _mockToken) Ownable(msg.sender) {
        mockToken = _mockToken;

        // Ref: SPDD §18.3 example (10% disaster-relief ceiling). Medical/community ceilings
        // are placeholders pending explicit product decision; adjustable by owner below.
        categoryAdminCeilingPct[CampaignCategory.DISASTER_RELIEF] = 10;
        categoryAdminCeilingPct[CampaignCategory.MEDICAL] = 15;
        categoryAdminCeilingPct[CampaignCategory.COMMUNITY] = 20;
    }

    /// @notice Admin-only: marks `organizer` as verified/unverified. Called by the app's
    ///         mock-KYB admin-approval flow (Step 6) — never called directly by an organizer.
    function setOrganizerVerified(address organizer, bool verified) external onlyOwner {
        isVerifiedOrganizer[organizer] = verified;
        emit OrganizerVerifiedSet(organizer, verified);
    }

    /// @notice Admin-only: adjust a category's admin-expense ceiling.
    function setCategoryAdminCeiling(CampaignCategory category, uint256 ceilingPct) external onlyOwner {
        categoryAdminCeilingPct[category] = ceilingPct;
    }

    /// @notice Deploys a new CampaignVault for `msg.sender` if all business rules pass.
    /// @dev All three checks are the non-bypassable, contract-level layer of defense-in-depth
    ///      (SPDD §19.2) — the API/UI layers also validate these for fast UX feedback, but
    ///      this is the check that actually matters.
    function createCampaign(
        CampaignCategory category,
        uint256 fundingGoal,
        MilestoneInput[] calldata milestones,
        uint256 adminCapPct
    ) external returns (uint256 campaignId, address vault) {
        if (!isVerifiedOrganizer[msg.sender]) revert OrganizerNotVerified(msg.sender);

        uint256 ceiling = categoryAdminCeilingPct[category];
        if (adminCapPct > ceiling) revert AdminCapExceeded(adminCapPct, ceiling);

        if (milestones.length == 0) revert NoMilestones();
        uint256 sum;
        for (uint256 i = 0; i < milestones.length; i++) {
            sum += milestones[i].targetPct;
        }
        if (sum != 100) revert MilestonesDoNotSumTo100(sum);

        vault = address(new CampaignVault(mockToken, msg.sender));

        campaignId = _campaigns.length;
        _campaigns.push(
            CampaignRecord({
                vault: vault,
                organizer: msg.sender,
                category: category,
                fundingGoal: fundingGoal,
                adminCapPct: adminCapPct
            })
        );
        _campaignIndexesByOrganizer[msg.sender].push(campaignId);

        emit CampaignCreated(campaignId, msg.sender, vault, category, fundingGoal);
    }

    /// @notice Returns all campaign IDs created by `organizer`, for dashboard enumeration.
    function getCampaignsByOrganizer(address organizer) external view returns (uint256[] memory) {
        return _campaignIndexesByOrganizer[organizer];
    }

    /// @notice Returns full campaign record by ID.
    function getCampaign(uint256 campaignId) external view returns (CampaignRecord memory) {
        return _campaigns[campaignId];
    }

    /// @notice Total number of campaigns created through this factory.
    function campaignCount() external view returns (uint256) {
        return _campaigns.length;
    }
}
