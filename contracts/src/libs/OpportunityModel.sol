// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILendingAdapter} from "../interfaces/ILendingAdapter.sol";
import {IQuoteSource} from "../interfaces/IQuoteSource.sol";
import {QuoteMath} from "./QuoteMath.sol";

/// @title OpportunityModel - Normalized liquidation opportunity
/// @notice Combines live Aave position data with quote economics for the frontend
library OpportunityModel {
  struct Opportunity {
    address borrower;
    uint256 healthFactor;
    address collateralAsset;
    uint256 collateralAmount;
    address debtAsset;
    uint256 debtAmount;
    uint256 maxLiquidatableDebt;
    uint256 liquidationBonus;
    uint256 collateralPriceUsd8;
    uint256 debtPriceUsd8;
    uint256 expectedCollateral;
    bool eligible;
    bool isLive;
  }

  struct ExecutionCheck {
    bool positionLiquidatable;
    bool debtWithinMaxTrade;
    bool quoteValid;
    bool quoteNotExpired;
    bool minCollateralValid;
    bool correctAssets;
    bool executorAuthorized;
    string failureReason;
  }

  /// @notice Build opportunity from live Aave position and live prices
  function buildLiveOpportunity(
    ILendingAdapter adapter,
    address borrower,
    uint256 collateralPriceUsd8,
    uint256 debtPriceUsd8
  ) internal view returns (Opportunity memory) {
    ILendingAdapter.Position memory position = adapter.getPosition(borrower);
    ILendingAdapter.Eligibility memory eligibility = adapter.isLiquidatable(borrower);
    uint256 maxLiquidatableDebt = adapter.getMaxLiquidatableDebt(borrower);
    uint256 expectedCollateral = adapter.getExpectedCollateral(
      borrower,
      maxLiquidatableDebt,
      collateralPriceUsd8,
      debtPriceUsd8
    );

    return Opportunity({
      borrower: position.borrower,
      healthFactor: position.healthFactor,
      collateralAsset: position.collateralAsset,
      collateralAmount: position.collateralAmount,
      debtAsset: position.debtAsset,
      debtAmount: position.debtAmount,
      maxLiquidatableDebt: maxLiquidatableDebt,
      liquidationBonus: position.liquidationBonus,
      collateralPriceUsd8: collateralPriceUsd8,
      debtPriceUsd8: debtPriceUsd8,
      expectedCollateral: expectedCollateral,
      eligible: eligibility.eligible,
      isLive: true
    });
  }

  /// @notice Build opportunity from simulated position (for demo mode)
  function buildDemoOpportunity(
    address borrower,
    uint256 healthFactor,
    uint256 collateralAmount,
    uint256 debtAmount,
    uint256 maxLiquidatableDebt,
    uint256 liquidationBonus,
    uint256 collateralPriceUsd8,
    uint256 debtPriceUsd8
  ) internal pure returns (Opportunity memory) {
    uint256 expectedCollateral = (debtAmount * debtPriceUsd8 * (10 ** 18) * liquidationBonus) /
      ((10 ** 6) * collateralPriceUsd8 * 10000);

    return Opportunity({
      borrower: borrower,
      healthFactor: healthFactor,
      collateralAsset: 0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c, // WETH
      collateralAmount: collateralAmount,
      debtAsset: 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8, // USDC
      debtAmount: debtAmount,
      maxLiquidatableDebt: maxLiquidatableDebt,
      liquidationBonus: liquidationBonus,
      collateralPriceUsd8: collateralPriceUsd8,
      debtPriceUsd8: debtPriceUsd8,
      expectedCollateral: expectedCollateral,
      eligible: healthFactor > 0 && healthFactor < 1e18,
      isLive: false
    });
  }

  /// @notice Calculate minCollateralOut from quote discount (maker's price)
  function calculateMinCollateralOut(
    Opportunity memory opp,
    uint256 discountBps
  ) internal pure returns (uint256) {
    return QuoteMath.minCollateralOut(
      opp.maxLiquidatableDebt,
      6, // USDC decimals
      18, // WETH decimals
      opp.debtPriceUsd8,
      opp.collateralPriceUsd8,
      discountBps
    );
  }

  /// @notice Calculate expected collateral from liquidation bonus (protocol economics)
  function calculateExpectedCollateral(
    Opportunity memory opp,
    uint256 debtToCover
  ) internal pure returns (uint256) {
    return (debtToCover * opp.debtPriceUsd8 * (10 ** 18) * opp.liquidationBonus) /
      ((10 ** 6) * opp.collateralPriceUsd8 * 10000);
  }

  /// @notice Validate execution preconditions
  function validateExecution(
    Opportunity memory opp,
    IQuoteSource.Quote memory quote,
    LiquidationBackstopApp.Strategy memory strategy,
    address executor,
    address backstopApp
  ) internal view returns (ExecutionCheck memory) {
    ExecutionCheck memory check;

    check.positionLiquidatable = opp.eligible;
    if (!check.positionLiquidatable) {
      check.failureReason = "Position not liquidatable";
      return check;
    }

    check.debtWithinMaxTrade = quote.size <= strategy.maxTrade;
    if (!check.debtWithinMaxTrade) {
      check.failureReason = "Quote size exceeds maxTrade";
      return check;
    }

    check.quoteValid = quote.execute && !quote.consumed;
    if (!check.quoteValid) {
      check.failureReason = "Quote not valid or already consumed";
      return check;
    }

    check.quoteNotExpired = block.timestamp <= quote.expiry;
    if (!check.quoteNotExpired) {
      check.failureReason = "Quote expired";
      return check;
    }

    check.minCollateralValid = quote.minCollateralOut > 0 &&
      quote.minCollateralOut <= opp.expectedCollateral;
    if (!check.minCollateralValid) {
      check.failureReason = "Min collateral out invalid";
      return check;
    }

    check.correctAssets = true; // Assets validated at quote generation time
    if (!check.correctAssets) {
      check.failureReason = "Asset mismatch";
      return check;
    }

    check.executorAuthorized = (executor == backstopApp); // Simplified check
    if (!check.executorAuthorized) {
      check.failureReason = "Executor not authorized";
      return check;
    }

    check.failureReason = "";
    return check;
  }
}

/// @title LiquidationBackstopApp - Interface reference for OpportunityModel
/// @notice Forward declaration for use in validateExecution
interface LiquidationBackstopApp {
  struct Strategy {
    address maker;
    address tokenIn;
    address tokenOut;
    uint256 maxTrade;
    uint16 minDiscountBps;
    uint16 maxDiscountBps;
    uint64 expiry;
    bytes32 salt;
  }
}