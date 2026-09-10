// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILendingAdapter} from "../interfaces/ILendingAdapter.sol";
import {MockLendingPool} from "../LiquidatorExecutor.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title MockLendingPoolAdapter - Wraps MockLendingPool to implement ILendingAdapter
/// @notice Allows existing tests to use MockLendingPool with the new adapter interface
contract MockLendingPoolAdapter is ILendingAdapter {
  MockLendingPool public immutable lendingPool;
  address public immutable debtToken;
  address public immutable collateralToken;

  constructor(MockLendingPool pool_, address debtToken_, address collateralToken_) {
    lendingPool = pool_;
    debtToken = debtToken_;
    collateralToken = collateralToken_;
  }

  function name() external pure returns (string memory) {
    return "Mock Lending Pool";
  }

  function supportedChainId() external pure returns (uint256) {
    return 11155111;
  }

  function pool() external view returns (address) {
    return address(lendingPool);
  }

  function oracle() external pure returns (address) {
    return address(0);
  }

  function getHealthFactor(address borrower) external view returns (uint256) {
    return lendingPool.healthFactor(borrower);
  }

  function getPosition(address borrower) external view returns (ILendingAdapter.Position memory) {
    uint256 hf = lendingPool.healthFactor(borrower);
    uint256 collateral = lendingPool.borrowerCollateral(borrower);
    uint256 debt = lendingPool.borrowerDebt(borrower);

    ILendingAdapter.Eligibility memory eligibility = _checkLiquidatable(borrower, hf, collateral, debt);
    uint256 maxLiquidatableDebt = _calculateMaxLiquidatableDebt(debt);

    return ILendingAdapter.Position({
      borrower: borrower,
      collateralAsset: collateralToken,
      debtAsset: debtToken,
      collateralAmount: collateral,
      debtAmount: debt,
      collateralUsd: collateral,
      debtUsd: debt,
      healthFactor: hf,
      liquidationThreshold: 8500,
      liquidationBonus: 10500,
      collateralDecimals: 18,
      debtDecimals: 6,
      maxLiquidatableDebt: maxLiquidatableDebt,
      liquidatable: eligibility.eligible
    });
  }

  function isLiquidatable(address borrower) external view returns (ILendingAdapter.Eligibility memory) {
    uint256 hf = lendingPool.healthFactor(borrower);
    uint256 collateral = lendingPool.borrowerCollateral(borrower);
    uint256 debt = lendingPool.borrowerDebt(borrower);
    return _checkLiquidatable(borrower, hf, collateral, debt);
  }

  function _checkLiquidatable(
    address borrower,
    uint256 healthFactor,
    uint256 collateralAmount,
    uint256 debtAmount
  ) internal view returns (ILendingAdapter.Eligibility memory) {
    if (healthFactor == 0) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "No debt position"});
    }
    if (healthFactor >= 1e18) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "Health factor >= 1"});
    }
    if (debtAmount == 0) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "No debt"});
    }
    if (collateralAmount == 0) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "No collateral"});
    }
    if (_calculateMaxLiquidatableDebt(debtAmount) == 0) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "No liquidatable debt available"});
    }

    return ILendingAdapter.Eligibility({eligible: true, reason: ""});
  }

  function getMaxLiquidatableDebt(address borrower) external view returns (uint256) {
    uint256 debt = lendingPool.borrowerDebt(borrower);
    return _calculateMaxLiquidatableDebt(debt);
  }

  function _calculateMaxLiquidatableDebt(uint256 debtAmount) internal pure returns (uint256) {
    // 50% close factor
    return (debtAmount * 5000) / 10000;
  }

  function getExpectedCollateral(
    address borrower,
    uint256 debtToCover,
    uint256 collateralPriceUsd8,
    uint256 debtPriceUsd8
  ) external view returns (uint256) {
    // Mock uses 1:1 ratio with liquidation bonus of 10500 bps
    if (debtPriceUsd8 == 0 || collateralPriceUsd8 == 0) return 0;
    uint256 BPS = 10000;
    return (debtToCover * debtPriceUsd8 * (10 ** 18) * 10500) /
      ((10 ** 6) * collateralPriceUsd8 * BPS);
  }

  function liquidationCall(
    address collateralAsset_,
    address debtAsset_,
    address borrower,
    uint256 debtToCover,
    bool /* receiveAToken */
  ) external payable returns (uint256) {
    // Validate debtToCover doesn't exceed max liquidatable
    uint256 maxLiquidatable = _calculateMaxLiquidatableDebt(lendingPool.borrowerDebt(borrower));
    require(debtToCover <= maxLiquidatable, "Debt exceeds max liquidatable amount");

    uint256 collateralSeized = lendingPool.liquidationCall(borrower, debtToCover);

    // Normalize from debt token decimals to collateral token decimals.
    // The mock pool uses a 1:1 notional ratio, so we rescale by the decimal
    // difference to keep units consistent with the actual collateral token.
    uint8 debtDecimals = debtAsset_.code.length > 0 ? IERC20Metadata(debtAsset_).decimals() : 18;
    uint8 collateralDecimals = collateralAsset_.code.length > 0 ? IERC20Metadata(collateralAsset_).decimals() : 18;
    if (debtDecimals > collateralDecimals) {
      collateralSeized = collateralSeized / (10 ** (debtDecimals - collateralDecimals));
    } else if (collateralDecimals > debtDecimals) {
      collateralSeized = collateralSeized * (10 ** (collateralDecimals - debtDecimals));
    }

    return collateralSeized;
  }

  function collateralAsset(address /* borrower */) external view returns (address) {
    return collateralToken;
  }

  function debtAsset(address /* borrower */) external view returns (address) {
    return debtToken;
  }
}