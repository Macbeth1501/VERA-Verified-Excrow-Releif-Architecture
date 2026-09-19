// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice The slice of CampaignVault this contract uses.
interface ICampaignVault {
    function organizer() external view returns (address);
    function milestoneManager() external view returns (address);
    function getBalance() external view returns (uint256);
    function releaseForMilestone(address to, uint256 amount) external;
}

/// @title MilestoneManager
/// @notice One shared manager for every campaign vault. Owns each milestone's lifecycle
///         (Pending -> Verified -> Released): M-of-N trusted-attestor verification, then an
///         automatic-release path for small amounts or a council M-of-N approval for large ones.
///         It is the only address a vault will release funds to on request.
/// @dev Ref: SPDD §8.6, §16 Step 4, §17.1, §17.4, §18.3; FR-ESC-01, FR-GOV-01; NFR-10.
///      Immutable once deployed (NFR-15). The owner curates the attestor and council lists but
///      can never release funds or approve on anyone's behalf.
contract MilestoneManager is Ownable, ReentrancyGuard {
    /// @dev No single attestor may verify a milestone alone (NFR-10).
    uint256 public constant MIN_REQUIRED_ATTESTATIONS = 2;
    /// @dev The council can never be approved by a single signer (FR-GOV-01).
    uint256 public constant MIN_COUNCIL_THRESHOLD = 2;

    enum Status {
        Pending,
        Verified,
        Released
    }

    struct Milestone {
        uint256 targetPct; // whole percent of everything the campaign raises
        uint256 requiredAttestations; // M
        uint256 autoReleaseLimit; // mINR minor units, snapshot of the global limit at define time
        uint256 attestationCount;
        uint256 councilApprovals;
        Status status;
    }

    /// @notice Global pool of trusted attestors, curated by the owner (SPDD §8.7 demo design).
    mapping(address => bool) public isAttestor;
    /// @notice Global council members, curated by the owner.
    mapping(address => bool) public isCouncilMember;
    /// @notice Council approvals needed for a release above the auto-release limit (3 of 5 in the demo).
    uint256 public councilThreshold;
    /// @notice Releases at or below this amount need attestors only. Snapshotted per milestone
    ///         when it is defined, so changing it later cannot skip or add a council step.
    uint256 public autoReleaseLimit;

    mapping(address vault => Milestone[]) private _milestones;
    /// @notice Sum of the target percentages defined so far for a vault (must reach 100 to release).
    mapping(address vault => uint256) public definedPct;
    /// @notice Cumulative percentage of already released milestones for a vault.
    mapping(address vault => uint256) public releasedPct;
    /// @notice Total mINR already released from a vault through this manager.
    mapping(address vault => uint256) public releasedTotal;

    mapping(address vault => mapping(uint256 index => mapping(address attestor => bool))) public hasAttested;
    mapping(address vault => mapping(uint256 index => mapping(address member => bool))) public hasApproved;

    event AttestorSet(address indexed attestor, bool active);
    event CouncilMemberSet(address indexed member, bool active);
    event CouncilThresholdSet(uint256 threshold);
    event AutoReleaseLimitSet(uint256 limit);
    event MilestoneDefined(
        address indexed vault, uint256 indexed index, uint256 targetPct, uint256 requiredAttestations, uint256 autoReleaseLimit
    );
    event MilestoneAttested(address indexed vault, uint256 indexed index, address indexed attestor, bytes32 proofHash);
    event MilestoneVerified(address indexed vault, uint256 indexed index);
    event CouncilApproved(address indexed vault, uint256 indexed index, address indexed member);
    /// @notice The event the ledger reads: the vault itself emits nothing on release.
    event MilestoneReleased(address indexed vault, uint256 indexed index, address indexed recipient, uint256 amount);

    error ZeroAddress();
    error NotAttestor();
    error NotCouncilMember();
    error NotVaultOrganizer();
    error VaultNotBoundToThisManager();
    error InvalidTargetPct(uint256 pct);
    error TargetPctExceeds100(uint256 total);
    error InvalidRequiredAttestations(uint256 m);
    error InvalidCouncilThreshold(uint256 threshold);
    error UnknownMilestone(uint256 index);
    error MilestoneAlreadyReleased();
    error MilestoneNotVerified();
    error AlreadyAttested();
    error AlreadyApproved();
    error OrganizerCannotAttest();
    error MilestonesNotFullyDefined(uint256 definedPct);
    error OutOfOrder(uint256 expectedIndex);
    error InsufficientCouncilApprovals(uint256 have, uint256 need);
    error NothingToRelease();

    /// @param _autoReleaseLimit Initial auto-release limit in mINR minor units.
    /// @param _councilThreshold Initial council approvals needed above the limit (>= 2).
    constructor(uint256 _autoReleaseLimit, uint256 _councilThreshold) Ownable(msg.sender) {
        if (_councilThreshold < MIN_COUNCIL_THRESHOLD) revert InvalidCouncilThreshold(_councilThreshold);
        autoReleaseLimit = _autoReleaseLimit;
        councilThreshold = _councilThreshold;
    }

    // ---------------------------------------------------------------- owner: role lists

    function setAttestor(address attestor, bool active) external onlyOwner {
        if (attestor == address(0)) revert ZeroAddress();
        isAttestor[attestor] = active;
        emit AttestorSet(attestor, active);
    }

    function setCouncilMember(address member, bool active) external onlyOwner {
        if (member == address(0)) revert ZeroAddress();
        isCouncilMember[member] = active;
        emit CouncilMemberSet(member, active);
    }

    function setCouncilThreshold(uint256 threshold) external onlyOwner {
        if (threshold < MIN_COUNCIL_THRESHOLD) revert InvalidCouncilThreshold(threshold);
        councilThreshold = threshold;
        emit CouncilThresholdSet(threshold);
    }

    /// @notice Only affects milestones defined afterwards.
    function setAutoReleaseLimit(uint256 limit) external onlyOwner {
        autoReleaseLimit = limit;
        emit AutoReleaseLimitSet(limit);
    }

    // ---------------------------------------------------------------- organizer: define

    /// @notice The vault's organizer defines its milestones in order. Percentages may not exceed
    ///         100 in total, and nothing can be released until they total exactly 100.
    /// @dev Only vaults bound to this manager can be defined. A vault from anywhere else could
    ///      never call back into it, so it is rejected up front.
    function defineMilestone(address vault, uint256 targetPct, uint256 requiredAttestations) external returns (uint256 index) {
        ICampaignVault v = ICampaignVault(vault);
        if (v.milestoneManager() != address(this)) revert VaultNotBoundToThisManager();
        if (msg.sender != v.organizer()) revert NotVaultOrganizer();
        if (targetPct == 0 || targetPct > 100) revert InvalidTargetPct(targetPct);
        if (requiredAttestations < MIN_REQUIRED_ATTESTATIONS) revert InvalidRequiredAttestations(requiredAttestations);

        uint256 total = definedPct[vault] + targetPct;
        if (total > 100) revert TargetPctExceeds100(total);
        definedPct[vault] = total;

        index = _milestones[vault].length;
        _milestones[vault].push(
            Milestone({
                targetPct: targetPct,
                requiredAttestations: requiredAttestations,
                autoReleaseLimit: autoReleaseLimit,
                attestationCount: 0,
                councilApprovals: 0,
                status: Status.Pending
            })
        );
        emit MilestoneDefined(vault, index, targetPct, requiredAttestations, autoReleaseLimit);
    }

    // ---------------------------------------------------------------- attestors

    /// @notice A trusted attestor confirms the milestone is done. Each attestor counts once; the
    ///         campaign's own organizer can never attest. Reaching M moves the milestone to Verified.
    function submitAttestation(address vault, uint256 index, bytes32 proofHash) external {
        if (!isAttestor[msg.sender]) revert NotAttestor();
        if (msg.sender == ICampaignVault(vault).organizer()) revert OrganizerCannotAttest();
        Milestone storage m = _get(vault, index);
        if (m.status == Status.Released) revert MilestoneAlreadyReleased();
        if (hasAttested[vault][index][msg.sender]) revert AlreadyAttested();

        hasAttested[vault][index][msg.sender] = true;
        m.attestationCount += 1;
        emit MilestoneAttested(vault, index, msg.sender, proofHash);

        if (m.status == Status.Pending && m.attestationCount >= m.requiredAttestations) {
            m.status = Status.Verified;
            emit MilestoneVerified(vault, index);
        }
    }

    // ---------------------------------------------------------------- council

    /// @notice A council member approves a verified milestone's release (needed above the limit).
    function councilApprove(address vault, uint256 index) external {
        if (!isCouncilMember[msg.sender]) revert NotCouncilMember();
        Milestone storage m = _get(vault, index);
        if (m.status == Status.Released) revert MilestoneAlreadyReleased();
        if (m.status != Status.Verified) revert MilestoneNotVerified();
        if (hasApproved[vault][index][msg.sender]) revert AlreadyApproved();

        hasApproved[vault][index][msg.sender] = true;
        m.councilApprovals += 1;
        emit CouncilApproved(vault, index, msg.sender);
    }

    // ---------------------------------------------------------------- release

    /// @notice What a release of this milestone would pay right now: its cumulative share of
    ///         everything the vault has ever raised, minus what was already released.
    function releasableAmount(address vault, uint256 index) public view returns (uint256) {
        Milestone storage m = _get(vault, index);
        uint256 raised = ICampaignVault(vault).getBalance() + releasedTotal[vault];
        uint256 entitled = raised * (releasedPct[vault] + m.targetPct) / 100;
        return entitled > releasedTotal[vault] ? entitled - releasedTotal[vault] : 0;
    }

    /// @notice Permissionless once the rules are met: milestones must all be defined, be released
    ///         in order, be Verified, and (above the limit) have enough council approvals. Pays
    ///         the campaign's organizer; nobody can choose the recipient.
    function release(address vault, uint256 index) external nonReentrant {
        Milestone storage m = _get(vault, index);
        if (m.status == Status.Released) revert MilestoneAlreadyReleased();
        if (m.status != Status.Verified) revert MilestoneNotVerified();
        if (definedPct[vault] != 100) revert MilestonesNotFullyDefined(definedPct[vault]);
        if (releasedPct[vault] != _pctBefore(vault, index)) revert OutOfOrder(_nextIndex(vault));

        uint256 amount = releasableAmount(vault, index);
        if (amount == 0) revert NothingToRelease();
        if (amount > m.autoReleaseLimit && m.councilApprovals < councilThreshold) {
            revert InsufficientCouncilApprovals(m.councilApprovals, councilThreshold);
        }

        // Effects before interaction.
        m.status = Status.Released;
        releasedPct[vault] += m.targetPct;
        releasedTotal[vault] += amount;

        address recipient = ICampaignVault(vault).organizer();
        ICampaignVault(vault).releaseForMilestone(recipient, amount);
        emit MilestoneReleased(vault, index, recipient, amount);
    }

    // ---------------------------------------------------------------- views

    function milestoneCount(address vault) external view returns (uint256) {
        return _milestones[vault].length;
    }

    function getMilestone(address vault, uint256 index) external view returns (Milestone memory) {
        return _get(vault, index);
    }

    // ---------------------------------------------------------------- internals

    function _get(address vault, uint256 index) private view returns (Milestone storage) {
        if (index >= _milestones[vault].length) revert UnknownMilestone(index);
        return _milestones[vault][index];
    }

    /// @dev Sum of target percentages of milestones before `index`.
    function _pctBefore(address vault, uint256 index) private view returns (uint256 sum) {
        for (uint256 i = 0; i < index; i++) {
            sum += _milestones[vault][i].targetPct;
        }
    }

    /// @dev Index of the first milestone not yet released.
    function _nextIndex(address vault) private view returns (uint256 i) {
        uint256 n = _milestones[vault].length;
        while (i < n && _milestones[vault][i].status == Status.Released) i++;
    }
}
