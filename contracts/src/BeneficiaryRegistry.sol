// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The slice of CampaignVault this contract uses.
interface IVaultOrganizer {
    function organizer() external view returns (address);
}

/// @title BeneficiaryRegistry
/// @notice The on-chain half of beneficiary de-duplication: a public record that a given identity
///         fingerprint was registered once, and only once, for a campaign. The platform never sees
///         who the person is: the fingerprint is a salted hash made in the organizer's browser.
/// @dev Ref: SPDD 17.2, 18.5; FR-IDN-03. Immutable, no owner and no admin function (NFR-15), so a
///      compromised backend cannot rubber-stamp a duplicate: the DB check is only the fast path.
///
///      A "program" is one campaign, identified by its vault address. Only that vault's organizer
///      may register into it, using the same organizer check the MilestoneManager applies. A vault
///      not deployed by the CampaignFactory could name anyone as its organizer, but that only lets
///      them fill a namespace of their own; the Disbursement contract (Step 14) reads the vault's
///      real manager, so such a namespace can never be paid out from.
///
///      Nothing but hashes crosses this ABI: there is no function that accepts or stores plaintext.
contract BeneficiaryRegistry {
    /// @notice Whether this fingerprint is registered for this campaign.
    mapping(address vault => mapping(bytes32 identityHash => bool)) public isRegistered;

    /// @notice How many unique beneficiaries a campaign has registered.
    mapping(address vault => uint256) public beneficiaryCount;

    /// @notice `photoHash` is an optional fingerprint of a photo (zero when none was given).
    event BeneficiaryRegistered(address indexed vault, bytes32 indexed identityHash, bytes32 photoHash, uint256 index);

    error NotVaultOrganizer();
    error ZeroIdentityHash();
    error DuplicateBeneficiary(address vault, bytes32 identityHash);

    /// @notice Registers one unique beneficiary for the campaign, signed by the campaign's organizer.
    /// @dev Reverts on a repeat, so the same person cannot become two "unique" beneficiaries in one
    ///      campaign. The same fingerprint may still register under a different campaign.
    function register(address vault, bytes32 identityHash, bytes32 photoHash) external returns (uint256 index) {
        if (msg.sender != IVaultOrganizer(vault).organizer()) revert NotVaultOrganizer();
        if (identityHash == bytes32(0)) revert ZeroIdentityHash();
        if (isRegistered[vault][identityHash]) revert DuplicateBeneficiary(vault, identityHash);

        isRegistered[vault][identityHash] = true;
        index = beneficiaryCount[vault]++;
        emit BeneficiaryRegistered(vault, identityHash, photoHash, index);
    }
}
