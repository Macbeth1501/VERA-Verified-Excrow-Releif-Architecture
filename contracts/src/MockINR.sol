// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockINR
/// @notice A free, testnet-only mock token representing Indian Rupees (INR), standing in for a
///         real fiat-pegged stablecoin.
/// @dev Ref: SPDD §7.1, §18 (Mock ERC-20 with public mint() faucet). Anyone can mint any amount
///      to any address — intentional for a $0 PoC: it simulates a donor "converting" fiat into
///      spendable funds without a real payment rail. NEVER deploy this pattern to mainnet with
///      real value.
contract MockINR is ERC20 {
    /// @dev 6 decimals, matching common stablecoin convention (e.g. USDC), chosen over the
    ///      real-world 2-decimal paise subdivision to leave headroom for milestone percentage
    ///      math without compounding rounding error. Display formatting (showing "₹") is a
    ///      frontend concern, not a token-decimals concern.
    uint8 private constant DECIMALS = 6;

    constructor() ERC20("Mock Indian Rupee", "mINR") {}

    /// @notice Public faucet — mints `amount` of mINR to `to`.
    /// @dev No access control by design: testnet faucet token, zero real value.
    ///      Ref: FR-CMP-02 (simulated fiat on-ramp), SPDD §7.2.
    /// @param to Address to receive minted tokens.
    /// @param amount Amount to mint, in mINR's smallest unit (6 decimals).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
}
