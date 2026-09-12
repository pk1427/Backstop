// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {IAqua} from "@aqua/src/interfaces/IAqua.sol";
import {QuoteRegistry} from "../src/QuoteRegistry.sol";
import {LiquidationBackstopApp} from "../src/LiquidationBackstopApp.sol";
import {LiquidatorExecutor} from "../src/LiquidatorExecutor.sol";
import {AaveV3SepoliaAdapter} from "../src/adapters/AaveV3SepoliaAdapter.sol";

/// @notice Deploys the receiver-compatible production stack used by live CRE.
contract DeployLiveCreStack is Script {
    address internal constant FORWARDER = 0xF8344CFd5c43616a4366C34E3EEE75af79a74482;
    address internal constant AQUA = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
    address internal constant AAVE_POOL = 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951;
    address internal constant AAVE_ORACLE = 0x2da88497588bf89281816106C7259e31AF45a663;
    address internal constant AAVE_DATA_PROVIDER = 0x3e9708d80f7B3e43118013075F7e95CE3AB31F31;

    function run() external {
        vm.startBroadcast();

        QuoteRegistry registry = new QuoteRegistry(FORWARDER);
        AaveV3SepoliaAdapter adapter = new AaveV3SepoliaAdapter(AAVE_POOL, AAVE_ORACLE, AAVE_DATA_PROVIDER);
        LiquidationBackstopApp app = new LiquidationBackstopApp(IAqua(AQUA), registry);
        LiquidatorExecutor executor = new LiquidatorExecutor(IAqua(AQUA), adapter, address(app));

        app.setExecutor(address(executor));
        registry.setBackstopApp(address(app));

        vm.stopBroadcast();
    }
}
