// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CampaignVault
/// @notice Holds a single campaign's escrowed mINR funds. Non-custodial: funds can only ever
///         leave via `releaseForMilestone`, callable exclusively by the paired MilestoneManager.
/// @dev Ref: SPDD §18.2, Functional Roadmap Module 1.2 Sub-step 2, P5/P6 (Traceability Matrix §3.1).
///      One vault is deployed per campaign by CampaignFactory (Sub-step 3.4).
contract CampaignVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The mock stablecoin this vault accepts. Set immutably at deploy.
    IERC20 public immutable token;

    /// @notice The campaign organizer, for reference/display only — holds no special
    ///         fund-transfer privileges (organizers cannot self-release funds).
    address public immutable organizer;

    /// @notice The only address ever allowed to trigger a release. Set exactly once via
    ///         `setMilestoneManager`, after MilestoneManager.sol is deployed (Step 4/11).
    ///         Until set, `releaseForMilestone` always reverts.
    address public milestoneManager;

    /// @notice Running balance tracked internally for gas-cheap reads; always reconcilable
    ///         against `token.balanceOf(address(this))` (SPDD NFR-17).
    uint256 private _balance;

    /// @dev Ref: SPDD §18.2 — optional bounded, disclosed-only freeze demonstration.
    bool public paused;

    event DonationReceived(address indexed donor, uint256 amount, uint256 newBalance);
    event MilestoneManagerSet(address indexed manager);
    event FreezeRaised(string reason);
    event FreezeLifted();

    error ZeroAmount();
    error MilestoneManagerAlreadySet();
    error NotMilestoneManager();
    error VaultPaused();
    error InsufficientVaultBalance(uint256 requested, uint256 available);

    modifier onlyMilestoneManager() {
        if (msg.sender != milestoneManager) revert NotMilestoneManager();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert VaultPaused();
        _;
    }

    /// @param _token Address of the deployed MockINR (or any ERC-20) contract.
    /// @param _organizer Address of the verified organizer this campaign belongs to.
    constructor(address _token, address _organizer) {
        token = IERC20(_token);
        organizer = _organizer;
    }

    /// @notice One-time wiring of the MilestoneManager after it's deployed (Step 4/11).
    /// @dev Immutable in effect: reverts if already set. No admin override exists —
    ///      this is what makes "only the manager can release" a permanent guarantee,
    ///      not a policy. Ref: SPDD §18.2.
    function setMilestoneManager(address _manager) external {
        if (milestoneManager != address(0)) revert MilestoneManagerAlreadySet();
        milestoneManager = _manager;
        emit MilestoneManagerSet(_manager);
    }

    /// @notice Deposit `amount` of mINR into escrow.
    /// @dev Checks-effects-interactions + ReentrancyGuard against the classic
    ///      "drain funds mid-transaction" attack (SPDD §19.1).
    ///      Ref: FR-CMP-02.
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        // Effects before interaction.
        _balance += amount;

        // Interaction: pull tokens from the donor. Reverts on insufficient
        // balance/allowance via the ERC-20 itself — no silent partial success.
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit DonationReceived(msg.sender, amount, _balance);
    }

    /// @notice Current escrowed balance, as tracked internally.
    /// @dev Independently reconcilable at any time against `token.balanceOf(address(this))` —
    ///      this equality is exactly what the reconciliation job (SPDD §21, §23.1) checks.
    function getBalance() external view returns (uint256) {
        return _balance;
    }

    /// @notice Releases `amount` from escrow, e.g. toward a Disbursement contract.
    /// @dev STUB for this sub-step: MilestoneManager.sol does not exist yet (built in Step 4).
    ///      Fully exercised by tests once Step 4/11 wires a real manager. Callable ONLY by
    ///      the paired MilestoneManager — no admin key, including the organizer, can call this.
    ///      Ref: SPDD §18.2 ("no other address ... can call it").
    function releaseForMilestone(address to, uint256 amount)
        external
        nonReentrant
        onlyMilestoneManager
        whenNotPaused
    {
        if (amount > _balance) revert InsufficientVaultBalance(amount, _balance);
        _balance -= amount;
        token.safeTransfer(to, amount);
    }

    /// @notice Demonstration-only bounded freeze. Cannot divert funds — only blocks
    ///         `deposit`/`releaseForMilestone` while active, and always discloses why.
    /// @dev Ref: SPDD §4.2, §18.2, §20.2 — explicitly NOT a production compliance control.
    ///      Gated to the organizer for this skeleton; access control may be revisited when
    ///      the admin/compliance role (Module 9.6) is built.
    function pause(string calldata reason) external {
        require(msg.sender == organizer, "only organizer");
        paused = true;
        emit FreezeRaised(reason);
    }

    function unpause() external {
        require(msg.sender == organizer, "only organizer");
        paused = false;
        emit FreezeLifted();
    }
}
