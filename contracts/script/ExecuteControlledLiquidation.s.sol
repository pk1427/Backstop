// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {LiquidationBackstopApp} from "../src/LiquidationBackstopApp.sol";
import {LiquidatorExecutor} from "../src/LiquidatorExecutor.sol";

/// @notice Executes the newest CRE quote against the isolated controlled market.
/// @dev Strategy values intentionally match ShipControlledStrategy's onchain shipment.
contract ExecuteControlledLiquidation is Script {
    address internal constant MAKER = 0x659f1ddf3Afa31029B990D2202Df8B2094eE012E;
    address internal constant BORROWER = 0xf62c155Eb012303Cbba80cb246De20E05dd57051;
    address internal constant WETH = 0xB848Fedc37BebaF136e51CfF90Bf73BB0f0dE9e9;
    address internal constant USDC = 0xFd080b70bAefD6Bb19906c107A7240C4e5C2dcca;
    address internal constant EXECUTOR = 0x331d4f5D31C2FdaC0E5e729bEdae6eF102C2c726;

    bytes32 internal constant QUOTE_ID = 0xfc011fd25bae76ef00ccb88a0ce6c7368d40fd2a49e9acd0dd4a6f574da69d5c;
    uint64 internal constant STRATEGY_EXPIRY = 0x6aadb094;
    uint256 internal constant EXPECTED_WETH_OUT = 350000000000000000;

    function run() external {
        uint256 liquidatorKey = vm.parseUint(string.concat("0x", vm.envString("SEPOLIA_PRIVATE_KEY_1")));
        LiquidationBackstopApp.Strategy memory strategy = LiquidationBackstopApp.Strategy({
            maker: MAKER, tokenIn: WETH, tokenOut: USDC, maxTrade: 500e6,
            minDiscountBps: 100, maxDiscountBps: 500,
            expiry: STRATEGY_EXPIRY, salt: bytes32(0)
        });
        bytes32 strategyHash = keccak256(abi.encode(strategy));
        vm.startBroadcast(liquidatorKey);
        LiquidatorExecutor(EXECUTOR).execute(strategyHash, strategy, QUOTE_ID, BORROWER, EXPECTED_WETH_OUT);
        vm.stopBroadcast();
    }
}
