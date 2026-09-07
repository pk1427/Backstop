// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {QuoteRegistry} from "../src/QuoteRegistry.sol";

contract DeployQuoteRegistry is Script {
    address public constant SEPOLIA_FORWARDER = 0xF8344CFd5c43616a4366C34E3EEE75af79a74482;

    function run() public {
        vm.startBroadcast();

        QuoteRegistry quoteRegistry = new QuoteRegistry(SEPOLIA_FORWARDER);

        vm.stopBroadcast();

        // Log deployment details for verification
        // QuoteRegistry: <address>
        // Forwarder: 0xF8344CFd5c43616a4366C34E3EEE75af79a74482
    }
}
