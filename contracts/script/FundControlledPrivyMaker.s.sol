// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {MintableMockERC20} from "../src/mocks/MintableMockERC20.sol";

/// @notice Funds the Privy embedded maker with controlled-market btUSDC.
/// @dev The mock token owner is the existing position-01 test deployer.
/// Set CONTROLLED_MAKER to the embedded wallet address before broadcast.
contract FundControlledPrivyMaker is Script {
    address internal constant BT_USDC = 0xFd080b70bAefD6Bb19906c107A7240C4e5C2dcca;

    function run() external {
        uint256 deployerKey = vm.parseUint(string.concat("0x", vm.envString("SEPOLIA_PRIVATE_KEY_1")));
        address maker = vm.envAddress("CONTROLLED_MAKER");

        vm.startBroadcast(deployerKey);
        MintableMockERC20(BT_USDC).mint(maker, 1_000e6);
        vm.stopBroadcast();
    }
}
