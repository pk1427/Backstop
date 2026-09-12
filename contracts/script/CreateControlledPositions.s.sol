// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {MintableMockERC20} from "../src/mocks/MintableMockERC20.sol";
import {PriceAwareMockLendingPool} from "../src/mocks/PriceAwareMockLendingPool.sol";

/// @notice Adds two liquidatable borrowers to the isolated controlled market.
/// @dev At the current $1,500 controlled btWETH price:
/// Position 02 = 0.7 btWETH / 1,000 btUSDC => HF 0.8925.
/// Position 04 = 0.8 btWETH / 1,200 btUSDC => HF 0.8500.
contract CreateControlledPositions is Script {
    MintableMockERC20 internal constant WETH = MintableMockERC20(0xB848Fedc37BebaF136e51CfF90Bf73BB0f0dE9e9);
    PriceAwareMockLendingPool internal constant POOL = PriceAwareMockLendingPool(0x89803CfB464eB76ace81463361a34B86b3E7Bd2A);
    address internal constant POSITION_02 = 0x85D737640a6b86EBfd1AcEB9BE9992c90020bA1c;
    address internal constant POSITION_04 = 0x0Bc87b3FBbCBEb04595A503fbCe1d627cEd222ad;

    function run() external {
        uint256 deployerKey = vm.parseUint(string.concat("0x", vm.envString("SEPOLIA_PRIVATE_KEY_1")));
        uint256 position2Key = vm.parseUint(string.concat("0x", vm.envString("SEPOLIA_PRIVATE_KEY_2")));
        uint256 position4Key = vm.parseUint(string.concat("0x", vm.envString("SEPOLIA_PRIVATE_KEY_4")));

        vm.startBroadcast(deployerKey);
        WETH.mint(POSITION_02, 0.7e18);
        WETH.mint(POSITION_04, 0.8e18);
        POOL.fundBorrower(POSITION_02, 0.7e18, 1_000e6);
        POOL.fundBorrower(POSITION_04, 0.8e18, 1_200e6);
        vm.stopBroadcast();

        vm.startBroadcast(position2Key);
        WETH.approve(address(POOL), type(uint256).max);
        vm.stopBroadcast();
        vm.startBroadcast(position4Key);
        WETH.approve(address(POOL), type(uint256).max);
        vm.stopBroadcast();
    }
}
