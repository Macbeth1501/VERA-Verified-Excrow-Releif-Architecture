// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IVault, IManager} from "./Disbursement.sol";

/// @notice The slice of BeneficiaryRegistryV2 this contract reads.
interface IRegistryV2 {
    /// @notice Whether enough distinct attestors have confirmed this beneficiary exists.
    function isVerified(address vault, bytes32 identityHash) external view returns (bool);
}

/// @title DisbursementV2
/// @notice Identical to `Disbursement` except for one rule: a payout may only go to a beneficiary an
///         independent attestor has confirmed exists (`registry.isVerified`), not merely one the
///         organizer registered. This makes the check non-bypassable: with the first `Disbursement`
///         it lived only in the app and database.
/// @dev Ref: docs/FUTURE_CHANGES.md C6; SPDD 18.4; FR-ESC-02. Immutable, no owner (NFR-15). Same
///      DIVERGENCE FROM SPDD 18.4 as `Disbursement`: it sits downstream of the manager, so the
///      organizer receives the release and then hands it over here. It still cannot force an
///      organizer to hand the money over at all. `PayoutRecorded` has the same signature as the
///      first contract, so the indexer reads either. A vault's payouts are tracked per contract: if
///      an organizer used the first `Disbursement` earlier, those are not counted here.
contract DisbursementV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The mINR token, the milestone manager and the verifying beneficiary registry. All immutable.
    IERC20 public immutable token;
    IManager public immutable manager;
    IRegistryV2 public immutable registry;

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

    /// @notice A constructor address was the zero address.
    error ZeroAddress();
    /// @notice Only the vault's own organizer may record payouts.
    error NotVaultOrganizer();
    /// @notice The vault is not bound to the milestone manager this contract trusts.
    error VaultNotBoundToThisManager();
    /// @notice The milestone has not been released, so there is nothing to pay out.
    error MilestoneNotReleased();
    /// @notice This milestone's payout was already recorded.
    error MilestoneAlreadyDisbursed();
    /// @notice No independent attestor has confirmed this beneficiary exists (or not enough of them have).
    error BeneficiaryNotVerified();
    /// @notice The payout amount must be greater than zero.
    error ZeroAmount();
    /// @notice A payout needs a non-zero off-ramp reference hash.
    error MissingPayoutReference();
    /// @notice The payout is more than the released funds still unpaid.
    error ExceedsReleased(uint256 requested, uint256 available);

    constructor(address token_, address manager_, address registry_) {
        if (token_ == address(0) || manager_ == address(0) || registry_ == address(0)) revert ZeroAddress();
        token = IERC20(token_);
        manager = IManager(manager_);
        registry = IRegistryV2(registry_);
    }

    /// @notice How much of this campaign's released money has not yet been paid out by this contract.
    function payableRemaining(address vault) public view returns (uint256) {
        uint256 released = manager.releasedTotal(vault);
        uint256 paid = disbursedTotal[vault];
        return released > paid ? released - paid : 0;
    }

    /// @notice Records a payout for a released milestone to a VERIFIED beneficiary. The caller must be
    ///         the vault's organizer, who received the release, and must have approved this contract
    ///         for `amount` of mINR beforehand.
    /// @param payoutRef Reference of the simulated off-ramp transfer; only its hash is public.
    /// @dev Checks-effects-interactions, with the token transfer last and a reentrancy guard.
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
        if (!registry.isVerified(vault, identityHash)) revert BeneficiaryNotVerified();

        uint256 available = payableRemaining(vault);
        if (amount > available) revert ExceedsReleased(amount, available);

        isDisbursed[vault][milestoneIndex] = true;
        disbursedTotal[vault] += amount;

        token.safeTransferFrom(msg.sender, address(this), amount);
        emit PayoutRecorded(vault, milestoneIndex, identityHash, amount, payoutRef, msg.sender);
    }
}
