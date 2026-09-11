// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {LiquidationBackstopApp, LiquidatorExecutor} from "../src/LiquidatorExecutor.sol";
import {Phase3CRETest} from "./Phase3CRE.t.sol";

/// @notice Phase 5+ vertical slice: liquidator execute() trigger -> Aqua pull ->
/// mock liquidation callback -> WETH push, in one settlement transaction.
/// Also tests the new LiquidatorExecutor.execute() entrypoint.
contract Phase5FullIntegrationTest is Phase3CRETest {
    function testFullPipeline_AuthenticatedQuoteToAtomicSettlement() public {
        uint256 quoteSize = 1_000e18;
        bytes32 quoteId = keccak256("phase-5-full-pipeline");

        vm.prank(forwarder);
        quoteRegistry.onReport(
            "",
            abi.encode(quoteId, 200, quoteSize, quoteSize, uint64(block.timestamp + 1 hours), true)
        );

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

    function testLiquidatorExecute_TriggerSucceeds() public {
        uint256 quoteSize = 500e18;
        bytes32 quoteId = keccak256("liquidator-execute-test");

        vm.prank(forwarder);
        quoteRegistry.onReport(
            "",
            abi.encode(quoteId, 200, quoteSize, quoteSize, uint64(block.timestamp + 1 hours), true)
        );

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

        vm.prank(address(liquidator));
        uint256 settled = liquidatorExecutor.execute(
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
            borrower,
            quoteSize
        );

        assertEq(settled, quoteSize, "settled size via execute()");
        assertEq(usdc.balanceOf(maker), makerUsdcBefore - quoteSize, "maker USDC pulled");
        assertEq(weth.balanceOf(maker), makerWethBefore + quoteSize, "maker WETH pushed");
    }

    function testLiquidatorExecute_RevertsWithZeroBorrower() public {
        vm.prank(address(liquidator));
        vm.expectRevert();
        liquidatorExecutor.execute(
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
            bytes32(0),
            address(0),
            0
        );
    }

    function testLiquidatorExecute_EmitsRequestEvent() public {
        uint256 quoteSize = 100e18;
        bytes32 quoteId = keccak256("event-test");

        vm.prank(forwarder);
        quoteRegistry.onReport(
            "",
            abi.encode(quoteId, 200, quoteSize, quoteSize, uint64(block.timestamp + 1 hours), true)
        );

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

        vm.prank(address(liquidator));
        vm.expectEmit(true, true, true, true);
        emit LiquidatorExecutor.LiquidationRequested(address(liquidator), strategyHash, quoteId, borrower);
        liquidatorExecutor.execute(
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
            borrower,
            quoteSize
        );
    }

    function testLiquidatorExecute_EmitsCompletedEvent() public {
        uint256 quoteSize = 100e18;
        bytes32 quoteId = keccak256("completed-event-test");

        vm.prank(forwarder);
        quoteRegistry.onReport(
            "",
            abi.encode(quoteId, 200, quoteSize, quoteSize, uint64(block.timestamp + 1 hours), true)
        );

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

        vm.prank(address(liquidator));
        vm.expectEmit(true, false, true, false);
        emit LiquidatorExecutor.LiquidationCompleted(address(liquidator), strategyHash, quoteSize);
        liquidatorExecutor.execute(
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
            borrower,
            quoteSize
        );
    }
}
