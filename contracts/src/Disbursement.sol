// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice The slices of the other contracts this one reads. All are views: nothing here can
///         change a vault, a milestone or a registration.
interface IVault {
    function organizer() external view returns (address);
    function milestoneManager() external view returns (address);
}

interface IManager {
    struct Milestone {
        uint256 targetPct;
        uint256 requiredAttestations;
        uint256 autoReleaseLimit;
        uint256 attestationCount;
        uint256 councilApprovals;
        uint8 status; // 0 Pending, 1 Verified, 2 Released
    }

    function getMilestone(address vault, uint256 index) external view returns (Milestone memory);
    function releasedTotal(address vault) external view returns (uint256);
}

interface IRegistry {
    function isRegistered(address vault, bytes32 identityHash) external view returns (bool);
}

/// @title Disbursement
/// @notice Records the simulated payout of a released milestone to a registered beneficiary, and
///         anchors its payout reference on-chain so every payout is a permanent public line item
///         (answering P4, the silent-deduction case). No real off-ramp is called: the mINR is moved
///         into this contract, which is where money that has left the system comes to rest.
/// @dev Ref: SPDD 5.3 FR-ESC-02, 18.4; Functional Roadmap Module 4.2. Immutable, no owner (NFR-15).
///
///      DIVERGENCE FROM SPDD 18.4, recorded deliberately: the SPDD has the vault release straight
///      into this contract. MilestoneManager is already deployed and immutable and pays the vault's
///      organizer, and each vault binds its manager permanently at construction, so that path could
///      only be built by redeploying the manager and orphaning every live campaign. This contract
///      therefore sits DOWNSTREAM: the organizer receives the release and then hands it over here.
///      What it still guarantees, non-bypassably, is that a payout cannot be recorded unless the
///      milestone really is Released, the beneficiary really is registered, the milestone has not
///      been paid before, and the campaign's payouts never exceed what its manager actually released.
///      What it cannot do is force an organizer to hand the money over at all.
contract Disbursement is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The mINR token, the milestone manager and the beneficiary registry. All immutable.
    IERC20 public immutable token;
    IManager public immutable manager;
    IRegistry public immutable registry;

    /// @dev MilestoneManager.Status.Released.
    uint8 private constant RELEASED = 2;

    /// @notice Total paid out for a campaign, which can never exceed `manager.releasedTotal(vault)`.
    mapping(address vault => uint256) public disbursedTotal;

    /// @notice Whether this milestone's payout has already been recorded.
    mapping(address vault => mapping(uint256 index => bool)) public isDisbursed;

    /// @notice The public line item: who was paid (as a fingerprint), how much, and the off-ramp reference.
    event PayoutRecorded(
        address indexed vault,
        uint256 indexed milestoneIndex,
        bytes32 indexed identityHash,
        uint256 amount,
        bytes32 payoutRef,
        address organizer
    );

    error ZeroAddress();
    error NotVaultOrganizer();
    error VaultNotBoundToThisManager();
    error MilestoneNotReleased();
    error MilestoneAlreadyDisbursed();
    error BeneficiaryNotRegistered();
    error ZeroAmount();
    error MissingPayoutReference();
    error ExceedsReleased(uint256 requested, uint256 available);

    constructor(address token_, address manager_, address registry_) {
        if (token_ == address(0) || manager_ == address(0) || registry_ == address(0)) revert ZeroAddress();
        token = IERC20(token_);
        manager = IManager(manager_);
        registry = IRegistry(registry_);
    }

    /// @notice How much of this campaign's released money has not yet been paid out.
    function payableRemaining(address vault) public view returns (uint256) {
        uint256 released = manager.releasedTotal(vault);
        uint256 paid = disbursedTotal[vault];
        return released > paid ? released - paid : 0;
    }

    /// @notice Records a payout for a released milestone to a registered beneficiary. The caller must
    ///         be the vault's organizer, who received the release, and must have approved this
    ///         contract for `amount` of mINR beforehand.
    /// @param payoutRef Reference of the simulated off-ramp transfer; only its hash is public.
    /// @dev The cap is per campaign rather than per milestone because the manager stores no
    ///      per-milestone released amount (only `releasedTotal` and the event), so a per-milestone
    ///      figure could not be read back on-chain. Checks-effects-interactions, with the token
    ///      transfer last and a reentrancy guard.
    function disburse(address vault, uint256 milestoneIndex, bytes32 identityHash, uint256 amount, bytes32 payoutRef)
        external
        nonReentrant
    {
        IVault v = IVault(vault);
        if (msg.sender != v.organizer()) revert NotVaultOrganizer();
        if (v.milestoneManager() != address(manager)) revert VaultNotBoundToThisManager();
        if (amount == 0) revert ZeroAmount();
        if (payoutRef == bytes32(0)) revert MissingPayoutReference();
        if (isDisbursed[vault][milestoneIndex]) revert MilestoneAlreadyDisbursed();
        if (manager.getMilestone(vault, milestoneIndex).status != RELEASED) revert MilestoneNotReleased();
        if (!registry.isRegistered(vault, identityHash)) revert BeneficiaryNotRegistered();

        uint256 available = payableRemaining(vault);
        if (amount > available) revert ExceedsReleased(amount, available);

        isDisbursed[vault][milestoneIndex] = true;
        disbursedTotal[vault] += amount;

        token.safeTransferFrom(msg.sender, address(this), amount);
        emit PayoutRecorded(vault, milestoneIndex, identityHash, amount, payoutRef, msg.sender);
    }
}
