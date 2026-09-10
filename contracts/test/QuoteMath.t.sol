// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {QuoteMath} from "../src/libs/QuoteMath.sol";

contract QuoteMathTest is Test {
    uint256 constant USDC_PRICE = 1e8;
    uint256 constant WETH_PRICE = 3_421e8;

    function testUSDC6ToWETH18ExactConversion() public {
        uint256 out = QuoteMath.minCollateralOut(3_421e6, 6, 18, USDC_PRICE, WETH_PRICE, 0);
        assert(out == 1e18);
    }

    function testDiscountsIncreaseMinimumCollateral() public {
        uint256 one = QuoteMath.minCollateralOut(1_000e6, 6, 18, USDC_PRICE, WETH_PRICE, 100);
        uint256 two = QuoteMath.minCollateralOut(1_000e6, 6, 18, USDC_PRICE, WETH_PRICE, 200);
        uint256 five = QuoteMath.minCollateralOut(1_000e6, 6, 18, USDC_PRICE, WETH_PRICE, 500);
        assert(one < two && two < five);
    }

    function testRoundsDownInCollateralRawUnits() public {
        uint256 out = QuoteMath.minCollateralOut(1e6, 6, 18, USDC_PRICE, WETH_PRICE, 0);
        assertEq(out, 292312189418298); // floor(1 / 3421 WETH * 1e18)
    }

    function testRejectsZeroPriceAndInvalidDiscount() public {
        QuoteMathHarness harness = new QuoteMathHarness();
        vm.expectRevert(QuoteMath.InvalidPrice.selector);
        harness.quote(1e6, 0, 100);
        vm.expectRevert(QuoteMath.InvalidDiscount.selector);
        harness.quote(1e6, USDC_PRICE, 10_000);
    }

    function testLiquidationBonusIsSeparateFeasibilityValue() public {
        uint256 makerMinimum = QuoteMath.minCollateralOut(1_000e6, 6, 18, USDC_PRICE, WETH_PRICE, 200);
        uint256 seized = QuoteMath.collateralFromLiquidationBonus(1_000e6, 6, 18, USDC_PRICE, WETH_PRICE, 10_500);
        assertGt(seized, makerMinimum);
    }
}

contract QuoteMathHarness {
    function quote(uint256 debt, uint256 debtPrice, uint256 discount) external pure returns (uint256) {
        return QuoteMath.minCollateralOut(debt, 6, 18, debtPrice, 3421e8, discount);
    }
}
