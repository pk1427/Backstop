// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, stdError} from "forge-std/Test.sol";
import {AaveV3SepoliaAdapter} from "../src/adapters/AaveV3SepoliaAdapter.sol";

/// @notice Verify Aave V3 Sepolia configuration against official address book
/// @dev Run with: forge test --match-test testAaveSepolia_VerifyConfiguration --via-ir
contract AaveSepoliaVerificationTest is Test {
    address public constant EXPECTED_POOL = 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951;
    address public constant EXPECTED_ORACLE = 0x2da88497588bf89281816106C7259e31AF45a663;
    address public constant EXPECTED_USDC = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;
    address public constant EXPECTED_WETH = 0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c;
    uint256 public constant EXPECTED_CHAIN_ID = 11155111;

    AaveV3SepoliaAdapter public adapter;

    function setUp() public {
        adapter = new AaveV3SepoliaAdapter(
            EXPECTED_POOL,
            EXPECTED_ORACLE,
            address(0x3e9708d80f7B3e43118013075F7e95CE3AB31F31)
        );
    }

    function testAaveSepolia_VerifyConfiguration() public {
        assertEq(adapter.pool(), EXPECTED_POOL, "Pool address mismatch");
        assertEq(adapter.oracle(), EXPECTED_ORACLE, "Oracle address mismatch");
        assertEq(adapter.WETH(), EXPECTED_WETH, "WETH address mismatch");
        assertEq(adapter.USDC(), EXPECTED_USDC, "USDC address mismatch");
        assertEq(adapter.supportedChainId(), EXPECTED_CHAIN_ID, "Chain ID mismatch");
        assertEq(adapter.name(), "Aave V3 Sepolia", "Name mismatch");
    }

    function testAaveSepolia_Decimals() public view {
        assertEq(adapter.getDecimals(EXPECTED_WETH), 18, "WETH decimals");
        assertEq(adapter.getDecimals(EXPECTED_USDC), 6, "USDC decimals");
    }
}
