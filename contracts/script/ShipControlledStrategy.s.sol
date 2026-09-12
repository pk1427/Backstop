// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {IAqua} from "@aqua/src/interfaces/IAqua.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LiquidationBackstopApp} from "../src/LiquidationBackstopApp.sol";

/// @notice Creates the next bounded maker authorization for the controlled market.
contract ShipControlledStrategy is Script {
    address internal constant AQUA = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
    address internal constant APP = 0x42698126b5E4884A99905484d484ECe7fbF18A6a;
    address internal constant WETH = 0xB848Fedc37BebaF136e51CfF90Bf73BB0f0dE9e9;
    address internal constant USDC = 0xFd080b70bAefD6Bb19906c107A7240C4e5C2dcca;

    function run() external {
        uint256 makerKey = vm.parseUint(string.concat("0x", vm.envString("SEPOLIA_PRIVATE_KEY")));
        address maker = vm.addr(makerKey);
        LiquidationBackstopApp.Strategy memory strategy = LiquidationBackstopApp.Strategy({
            maker: maker, tokenIn: WETH, tokenOut: USDC, maxTrade: 500e6,
            minDiscountBps: 100, maxDiscountBps: 500,
            // New salt creates a fresh authorization after the first 500 btUSDC
            // strategy was consumed. Keep this expiry aligned with the frontend.
            expiry: 1791760000, salt: bytes32(uint256(1))
        });
        address[] memory tokens = new address[](2);
        tokens[0] = USDC; tokens[1] = WETH;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 500e6;

        vm.startBroadcast(makerKey);
        IERC20(USDC).approve(AQUA, type(uint256).max);
        IAqua(AQUA).ship(APP, abi.encode(strategy), tokens, amounts);
        vm.stopBroadcast();
    }
}
