// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVaultOrganizer} from "./BeneficiaryRegistry.sol";

/// @notice The slice of MilestoneManager this contract reads: whether an address is a registered attestor.
interface IAttestorList {
    /// @notice Whether the address is an owner-curated attestor.
    function isAttestor(address account) external view returns (bool);
}

/// @title BeneficiaryRegistryV2
/// @notice BeneficiaryRegistry plus independent verification: an attestor registered on the
///         MilestoneManager can confirm that a registered beneficiary really exists. A beneficiary is
///         "verified" once `requiredAttestations` distinct attestors have confirmed them. This closes
///         the gap the first registry could not: it proved a beneficiary is UNIQUE, not that they EXIST.
/// @dev Ref: docs/FUTURE_CHANGES.md C6. `register` is unchanged in behaviour and event, so the indexer
///      and the app's registration flow work as before. Immutable, no owner and no admin function
///      (NFR-15): the attestor list belongs to the existing MilestoneManager, read through an
///      interface, and the required count is fixed at construction.
///
///      The attestor is a wallet; like everything on-chain it is a fingerprint, never a name. The
///      vault's own organizer can never attest, and each attestor counts once per beneficiary.
///      `attestBeneficiary` takes the same salted fingerprint the organizer registered, so an
///      attestor must know the person to produce it; a wrong fingerprint simply reverts as unregistered.
contract BeneficiaryRegistryV2 {
    /// @notice The MilestoneManager whose attestor list decides who may confirm a beneficiary.
    IAttestorList public immutable manager;

    /// @notice Distinct attestors needed before a beneficiary counts as verified (at least 1).
    uint256 public immutable requiredAttestations;

    /// @notice Whether this fingerprint is registered for this campaign.
    mapping(address vault => mapping(bytes32 identityHash => bool)) public isRegistered;

    /// @notice How many unique beneficiaries a campaign has registered.
    mapping(address vault => uint256) public beneficiaryCount;

    /// @notice How many distinct attestors have confirmed this beneficiary.
    mapping(address vault => mapping(bytes32 identityHash => uint256)) public attestationCount;

    /// @notice Whether this attestor has already confirmed this beneficiary.
    mapping(address vault => mapping(bytes32 identityHash => mapping(address attestor => bool))) public hasAttested;

    /// @notice `photoHash` is an optional fingerprint of a photo (zero when none was given).
    event BeneficiaryRegistered(address indexed vault, bytes32 indexed identityHash, bytes32 photoHash, uint256 index);

    /// @notice An attestor confirmed a beneficiary; `count` is how many have now done so.
    event BeneficiaryAttested(address indexed vault, bytes32 indexed identityHash, address indexed attestor, uint256 count);

    /// @notice Only the vault's own organizer may register beneficiaries for it.
    error NotVaultOrganizer();
    /// @notice An identity fingerprint of zero is not a valid registration.
    error ZeroIdentityHash();
    /// @notice This fingerprint is already registered for this vault.
    error DuplicateBeneficiary(address vault, bytes32 identityHash);
    /// @notice Only a registered attestor may confirm a beneficiary.
    error NotAttestor();
    /// @notice A campaign's own organizer cannot confirm its beneficiaries.
    error OrganizerCannotAttest();
    /// @notice This fingerprint is not registered for this vault, so there is nothing to confirm.
    error BeneficiaryNotRegistered(address vault, bytes32 identityHash);
    /// @notice This attestor already confirmed this beneficiary.
    error AlreadyAttested();
    /// @notice A constructor address was the zero address.
    error ZeroAddress();
    /// @notice At least one attestation must be required.
    error InvalidRequiredAttestations(uint256 required);

    constructor(address manager_, uint256 requiredAttestations_) {
        if (manager_ == address(0)) revert ZeroAddress();
        if (requiredAttestations_ == 0) revert InvalidRequiredAttestations(requiredAttestations_);
        manager = IAttestorList(manager_);
        requiredAttestations = requiredAttestations_;
    }

    /// @notice Registers one unique beneficiary for the campaign, signed by the campaign's organizer.
    /// @dev Identical to `BeneficiaryRegistry.register`. Reverts on a repeat.
    function register(address vault, bytes32 identityHash, bytes32 photoHash) external returns (uint256 index) {
        if (msg.sender != IVaultOrganizer(vault).organizer()) revert NotVaultOrganizer();
        if (identityHash == bytes32(0)) revert ZeroIdentityHash();
        if (isRegistered[vault][identityHash]) revert DuplicateBeneficiary(vault, identityHash);

        isRegistered[vault][identityHash] = true;
        index = beneficiaryCount[vault]++;
        emit BeneficiaryRegistered(vault, identityHash, photoHash, index);
    }

    /// @notice An attestor confirms that a registered beneficiary exists.
    /// @dev Checks-effects only: no external call follows the state change. The attestor check reads
    ///      the manager (a view), the organizer check reads the vault (a view).
    function attestBeneficiary(address vault, bytes32 identityHash) external {
        if (!manager.isAttestor(msg.sender)) revert NotAttestor();
        if (msg.sender == IVaultOrganizer(vault).organizer()) revert OrganizerCannotAttest();
        if (!isRegistered[vault][identityHash]) revert BeneficiaryNotRegistered(vault, identityHash);
        if (hasAttested[vault][identityHash][msg.sender]) revert AlreadyAttested();

        hasAttested[vault][identityHash][msg.sender] = true;
        uint256 count = ++attestationCount[vault][identityHash];
        emit BeneficiaryAttested(vault, identityHash, msg.sender, count);
    }

    /// @notice Whether enough distinct attestors have confirmed this beneficiary.
    function isVerified(address vault, bytes32 identityHash) public view returns (bool) {
        return attestationCount[vault][identityHash] >= requiredAttestations;
    }
}
