// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {IAqua} from "@aqua/src/interfaces/IAqua.sol";
import {QuoteRegistry} from "../src/QuoteRegistry.sol";
import {LiquidationBackstopApp} from "../src/LiquidationBackstopApp.sol";
import {LiquidatorExecutor} from "../src/LiquidatorExecutor.sol";
import {PriceAwareMockLendingPoolAdapter} from "../src/adapters/PriceAwareMockLendingPoolAdapter.sol";

/// @notice Staging-only CRE receiver and settlement stack for the controlled mock market.
contract DeployControlledBackstopStack is Script {
    address internal constant FORWARDER = 0xF8344CFd5c43616a4366C34E3EEE75af79a74482;
    address internal constant AQUA = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
    address internal constant ADAPTER = 0xc092C4ca5f5566545E49518662Ac6f35cbbc92C8;

    function run() external {
        uint256 deployerKey = vm.parseUint(string.concat("0x", vm.envString("SEPOLIA_PRIVATE_KEY_1")));
        vm.startBroadcast(deployerKey);
        QuoteRegistry registry = new QuoteRegistry(FORWARDER);
        LiquidationBackstopApp app = new LiquidationBackstopApp(IAqua(AQUA), registry);
        LiquidatorExecutor executor = new LiquidatorExecutor(IAqua(AQUA), PriceAwareMockLendingPoolAdapter(ADAPTER), address(app));
        app.setExecutor(address(executor));
        registry.setBackstopApp(address(app));
        vm.stopBroadcast();
    }
}
