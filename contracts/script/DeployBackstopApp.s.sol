// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {LiquidationBackstopApp} from "../src/LiquidationBackstopApp.sol";
import {IAqua} from "@aqua/src/interfaces/IAqua.sol";
import {QuoteRegistry} from "../src/QuoteRegistry.sol";

contract DeployBackstopApp is Script {
    address public constant AQUA_REGISTRY = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
    address public constant QUOTE_REGISTRY = 0xe39e8eC1e77bc9F9E36e552105362F9D5BEe0F95;

    function run() public {
        vm.startBroadcast();

        LiquidationBackstopApp backstopApp = new LiquidationBackstopApp(
            IAqua(AQUA_REGISTRY),
            QuoteRegistry(QUOTE_REGISTRY)
        );

        vm.stopBroadcast();

        // Log deployment details
        // LiquidationBackstopApp: <address>
        // Aqua Registry: 0x1111113ccf1426a8e30e2bff5e005d929bf6a90a
        // QuoteRegistry: 0xe39e8ec1e77bc9f9e36e552105362f9d5bee0f95
    }
}
