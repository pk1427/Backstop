// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LiquidationBackstopApp} from "../src/LiquidationBackstopApp.sol";
import {Phase3CRETest} from "./Phase3CRE.t.sol";

/// @notice Phase 5 vertical slice: authenticated CRE quote -> Aqua pull ->
/// mock liquidation callback -> WETH push, in one settlement transaction.
/// The live CRE workflow uses the same report payload and forwarder boundary;
/// this test keeps the scenario deterministic until CRE deployment access is
/// available on Sepolia.
contract Phase5FullIntegrationTest is Phase3CRETest {
    function testFullPipeline_AuthenticatedQuoteToAtomicSettlement() public {
        uint256 quoteSize = 1_000e18;
        bytes32 quoteId = keccak256("phase-5-full-pipeline");

        // CRE's authenticated forwarder is the only quote writer.
        vm.prank(forwarder);
        quoteRegistry.onReport(
            "",
            abi.encode(quoteId, 200, quoteSize, quoteSize, uint64(block.timestamp + 1 hours), true)
        );

        // A borrower becomes unhealthy: 2,000 WETH collateral against 3,000 USDC debt.
        address borrower = address(0xB0B0);
        uint256 collateral = 2_000e18;
        uint256 debt = 3_000e18;
        weth.mint(borrower, collateral);
        usdc.mint(borrower, 5_000e18);
        vm.startPrank(borrower);
        weth.approve(address(lendingPool), collateral);
        usdc.approve(address(lendingPool), 5_000e18);
        vm.stopPrank();
        lendingPool.fundBorrower(borrower, collateral, debt);

        uint256 makerUsdcBefore = usdc.balanceOf(maker);
        uint256 makerWethBefore = weth.balanceOf(maker);

        // The executor receives Aqua-pulled USDC, liquidates, then pushes WETH.
        vm.prank(address(liquidatorExecutor));
        uint256 settled = backstopApp.swap(
            strategyHash,
            LiquidationBackstopApp.Strategy({
                maker: maker,
                tokenIn: address(weth),
                tokenOut: address(usdc),
                maxTrade: 1_000e18,
                minDiscountBps: 100,
                maxDiscountBps: 500,
                expiry: uint64(block.timestamp + 365 days),
                salt: bytes32(0)
            }),
            quoteId,
            abi.encode(borrower, quoteSize)
        );

        assertEq(settled, quoteSize, "settled size");
        assertEq(usdc.balanceOf(maker), makerUsdcBefore - quoteSize, "maker USDC pulled");
        assertEq(weth.balanceOf(maker), makerWethBefore + quoteSize, "maker WETH pushed");
        assertEq(lendingPool.borrowerDebt(borrower), debt - quoteSize, "borrower debt repaid");
        assertEq(lendingPool.borrowerCollateral(borrower), collateral - quoteSize, "borrower collateral seized");
    }
}
