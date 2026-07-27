// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice A free, testnet-only mock stablecoin standing in for a real USDC-pegged token.
/// @dev Ref: SPDD §7.1, §18 (Mock ERC-20 "mUSDC" with public mint() faucet).
///      Anyone can mint any amount to any address — intentional for a $0 PoC: it simulates
///      a donor "converting" fiat into spendable funds without a real payment rail.
///      NEVER deploy this pattern to mainnet with real value.
contract MockUSDC is ERC20 {
    /// @dev mUSDC uses 6 decimals, matching real USDC, so amounts read naturally in the UI.
    uint8 private constant DECIMALS = 6;

    constructor() ERC20("Mock USD Coin", "mUSDC") {}

    /// @notice Public faucet — mints `amount` of mUSDC to `to`.
    /// @dev No access control by design: testnet faucet token, zero real value.
    ///      Ref: FR-CMP-02 (simulated fiat on-ramp), SPDD §7.2.
    /// @param to Address to receive minted tokens.
    /// @param amount Amount to mint, in mUSDC's smallest unit (6 decimals).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
}
