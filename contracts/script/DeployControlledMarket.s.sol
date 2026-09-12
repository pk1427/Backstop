// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {MintableMockERC20} from "../src/mocks/MintableMockERC20.sol";
import {MockPriceOracle} from "../src/mocks/MockPriceOracle.sol";
import {PriceAwareMockLendingPool} from "../src/mocks/PriceAwareMockLendingPool.sol";
import {PriceAwareMockLendingPoolAdapter} from "../src/adapters/PriceAwareMockLendingPoolAdapter.sol";

/// @notice Deploys an isolated oracle-controlled market for staging demonstrations.
/// @dev Requires SEPOLIA_PRIVATE_KEY (maker) and SEPOLIA_PRIVATE_KEY_1 (deployer).
contract DeployControlledMarket is Script {
    address internal constant BORROWER = 0xf62c155Eb012303Cbba80cb246De20E05dd57051;

    function run() external {
        uint256 deployerKey = vm.parseUint(string.concat("0x", vm.envString("SEPOLIA_PRIVATE_KEY_1")));
        address maker = vm.addr(vm.parseUint(string.concat("0x", vm.envString("SEPOLIA_PRIVATE_KEY"))));

        vm.startBroadcast(deployerKey);
        MintableMockERC20 weth = new MintableMockERC20("Backstop Test WETH", "btWETH", 18);
        MintableMockERC20 usdc = new MintableMockERC20("Backstop Test USDC", "btUSDC", 6);
        MockPriceOracle oracle = new MockPriceOracle(vm.addr(deployerKey));
        PriceAwareMockLendingPool pool = new PriceAwareMockLendingPool(weth, usdc, oracle, 6);
        PriceAwareMockLendingPoolAdapter adapter = new PriceAwareMockLendingPoolAdapter(pool, address(usdc), address(weth), oracle);

        // Start healthy: one WETH at $2,000 against 1,500 USDC debt (HF 1.1333).
        oracle.setPrice(address(weth), 2_000e8);
        weth.mint(BORROWER, 1e18);
        usdc.mint(maker, 1_000e6);
        pool.fundBorrower(BORROWER, 1e18, 1_500e6);
        vm.stopBroadcast();
    }
}
