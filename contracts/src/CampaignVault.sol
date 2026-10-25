// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice The slice of MilestoneManager the vault reads to know whether the work is finished.
interface IMilestoneProgress {
    function releasedPct(address vault) external view returns (uint256);
}

/// @title CampaignVault
/// @notice Holds a single campaign's escrowed mINR funds. Non-custodial: funds can only ever
///         leave via `releaseForMilestone`, callable exclusively by the paired MilestoneManager,
///         or back to the donors who gave them once the campaign is closed (deadline passed, no
///         progress for the inactivity window, or all milestones released with money left).
/// @dev Ref: SPDD §18.2, Functional Roadmap Module 1.2 Sub-step 2, P5/P6 (Traceability Matrix §3.1).
///      One vault is deployed per campaign by CampaignFactory (Sub-step 3.4).
contract CampaignVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The mock stablecoin this vault accepts. Set immutably at deploy.
    IERC20 public immutable token;

    /// @notice The campaign organizer, for reference/display only — holds no special
    ///         fund-transfer privileges (organizers cannot self-release funds).
    address public immutable organizer;

    /// @notice The only address ever allowed to trigger a release. Fixed at deploy and
    ///         immutable: no setter exists, so no admin, organizer or third party can ever
    ///         change it. Ref: SPDD §18.2.
    address public immutable milestoneManager;

    /// @notice Running balance tracked internally for gas-cheap reads; always reconcilable
    ///         against `token.balanceOf(address(this))` (SPDD NFR-17).
    uint256 private _balance;

    /// @dev Ref: SPDD §18.2 — optional bounded, disclosed-only freeze demonstration.
    bool public paused;

    /// @notice Donations stop and anyone may close the campaign after this timestamp.
    uint64 public immutable deadline;
    /// @notice Seconds without a milestone release (counted from creation or the last release)
    ///         after which anyone may close the campaign and refund the donors.
    uint64 public immutable inactivityWindow;
    uint64 public immutable createdAt;
    /// @notice Creation time, then the time of the latest milestone release.
    uint64 public lastProgressAt;

    enum CloseReason {
        Deadline,
        Inactivity,
        Completed
    }

    /// @notice True once closed: deposits and releases are refused for good and donors can claim.
    bool public closed;
    /// @notice The balance left at the moment of closing; each donor's refund is a share of it.
    uint256 public refundPool;
    /// @notice Everything ever donated (the denominator of the refund shares).
    uint256 public totalDonated;
    mapping(address donor => uint256) public donatedBy;
    mapping(address donor => bool) public refundClaimed;

    event DonationReceived(address indexed donor, uint256 amount, uint256 newBalance);
    event FreezeRaised(string reason);
    event FreezeLifted();
    event CampaignClosed(CloseReason reason, uint256 refundPool);
    event RefundClaimed(address indexed donor, uint256 amount, uint256 newBalance);

    error ZeroAmount();
    error ZeroAddress();
    error NotMilestoneManager();
    error VaultPaused();
    error InsufficientVaultBalance(uint256 requested, uint256 available);
    error InvalidSchedule();
    error CampaignIsClosed();
    error DonationsClosed();
    error CannotCloseYet();
    error AlreadyClosed();
    error NothingToRefund();
    error NotClosed();
    error NoRefundDue();

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
    /// @param _milestoneManager The only address permitted to release funds. Must be non-zero.
    /// @param _deadline Timestamp after which donations stop and the campaign can be closed.
    /// @param _inactivityWindow Seconds without a release after which the campaign can be closed.
    constructor(address _token, address _organizer, address _milestoneManager, uint64 _deadline, uint64 _inactivityWindow) {
        if (_milestoneManager == address(0)) revert ZeroAddress();
        if (_deadline <= block.timestamp || _inactivityWindow == 0) revert InvalidSchedule();
        token = IERC20(_token);
        organizer = _organizer;
        milestoneManager = _milestoneManager;
        deadline = _deadline;
        inactivityWindow = _inactivityWindow;
        createdAt = uint64(block.timestamp);
        lastProgressAt = uint64(block.timestamp);
    }

    /// @notice Deposit `amount` of mINR into escrow.
    /// @dev Checks-effects-interactions + ReentrancyGuard against the classic
    ///      "drain funds mid-transaction" attack (SPDD §19.1).
    ///      Ref: FR-CMP-02.
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (closed) revert CampaignIsClosed();
        if (block.timestamp > deadline) revert DonationsClosed();

        // Effects before interaction.
        _balance += amount;
        totalDonated += amount;
        donatedBy[msg.sender] += amount;

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
    /// @dev Callable ONLY by the MilestoneManager fixed at construction — no admin key,
    ///      including the organizer, can call this.
    ///      Ref: SPDD §18.2 ("no other address ... can call it").
    function releaseForMilestone(address to, uint256 amount)
        external
        nonReentrant
        onlyMilestoneManager
        whenNotPaused
    {
        if (closed) revert CampaignIsClosed();
        if (amount > _balance) revert InsufficientVaultBalance(amount, _balance);
        _balance -= amount;
        lastProgressAt = uint64(block.timestamp);
        token.safeTransfer(to, amount);
    }

    // ---------------------------------------------------------------- closing and refunds

    /// @notice Whether the campaign can be closed right now, and why.
    ///         Completed: every milestone is released, so whatever is left goes back to donors.
    ///         Deadline: the end date passed. Inactivity: no release for `inactivityWindow`.
    function closableReason() public view returns (bool can, CloseReason reason) {
        if (closed || _balance == 0) return (false, CloseReason.Deadline);
        if (_allReleased()) return (true, CloseReason.Completed);
        if (block.timestamp > deadline) return (true, CloseReason.Deadline);
        if (block.timestamp > uint256(lastProgressAt) + inactivityWindow) return (true, CloseReason.Inactivity);
        return (false, CloseReason.Deadline);
    }

    /// @notice Anyone can close an expired, stalled or finished campaign. Freezes the balance
    ///         as the refund pool; each donor then claims their share with `claimRefund`.
    /// @dev Works while paused, so a pause can never trap donors. A milestone that is verified
    ///      but not yet released can still be released until someone closes the campaign.
    function close() external nonReentrant {
        if (closed) revert AlreadyClosed();
        if (_balance == 0) revert NothingToRefund();
        (bool can, CloseReason reason) = closableReason();
        if (!can) revert CannotCloseYet();
        closed = true;
        refundPool = _balance;
        emit CampaignClosed(reason, refundPool);
    }

    /// @notice What `donor` can claim now: their share of the pool, in proportion to what they gave.
    function refundOf(address donor) public view returns (uint256) {
        if (!closed || refundClaimed[donor] || totalDonated == 0) return 0;
        return refundPool * donatedBy[donor] / totalDonated;
    }

    /// @notice A donor takes back their share of what was left. Pull-based, once each.
    function claimRefund() external nonReentrant {
        if (!closed) revert NotClosed();
        uint256 amount = refundOf(msg.sender);
        if (amount == 0) revert NoRefundDue();

        // Effects before interaction.
        refundClaimed[msg.sender] = true;
        _balance -= amount;
        token.safeTransfer(msg.sender, amount);
        emit RefundClaimed(msg.sender, amount, _balance);
    }

    function _allReleased() private view returns (bool) {
        if (milestoneManager.code.length == 0) return false;
        return IMilestoneProgress(milestoneManager).releasedPct(address(this)) == 100;
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
