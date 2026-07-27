// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC internal token;
    address internal donor = address(0xBEEF);

    function setUp() public {
        token = new MockUSDC();
    }

    function test_MintIncreasesBalance() public {
        token.mint(donor, 100e6); // 100 mUSDC (6 decimals)
        assertEq(token.balanceOf(donor), 100e6);
    }

    function test_DecimalsIsSix() public view {
        assertEq(token.decimals(), 6);
    }
}
