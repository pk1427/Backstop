// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILendingAdapter} from "../interfaces/ILendingAdapter.sol";
import {MockLendingPool} from "../LiquidatorExecutor.sol";

/// @title MockLendingPoolAdapter - Wraps MockLendingPool to implement ILendingAdapter
/// @notice Allows existing tests to use MockLendingPool with the new adapter interface
contract MockLendingPoolAdapter is ILendingAdapter {
  MockLendingPool public immutable lendingPool;

  constructor(MockLendingPool pool_) {
    lendingPool = pool_;
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

    return ILendingAdapter.Position({
      borrower: borrower,
      collateralAsset: address(0),
      debtAsset: address(0),
      collateralUsd: collateral,
      debtUsd: debt,
      healthFactor: hf,
      liquidationThreshold: 8500,
      liquidationBonus: 10500,
      collateralDecimals: 18,
      debtDecimals: 6
    });
  }

  function isLiquidatable(address borrower) external view returns (bool) {
    uint256 hf = lendingPool.healthFactor(borrower);
    return hf > 0 && hf < 1e18;
  }

  address public constant MOCK_DEBT_TOKEN = address(0xDEAD);
  address public constant MOCK_COLLATERAL_TOKEN = address(0xBEEF);

  function liquidationCall(
    address /* collateralAsset */,
    address /* debtAsset */,
    address borrower,
    uint256 debtToCover,
    bool /* receiveAToken */
  ) external payable returns (uint256) {
    return lendingPool.liquidationCall(borrower, debtToCover);
  }

  function collateralAsset(address /* borrower */) external pure returns (address) {
    return MOCK_COLLATERAL_TOKEN;
  }

  function debtAsset(address /* borrower */) external pure returns (address) {
    return MOCK_DEBT_TOKEN;
  }
}
