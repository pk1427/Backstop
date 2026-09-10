// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IQuoteSource, ILendingAdapter} from "./interfaces/IQuoteSource.sol";
import {QuoteMath} from "./libs/QuoteMath.sol";

/// @title SimulatedQuoteSource - Demo quote source for testing
/// @notice Generates deterministic quotes based on position data
contract SimulatedQuoteSource is IQuoteSource {
  uint256 public constant DEFAULT_DISCOUNT_BPS = 200;
  uint256 public constant QUOTE_TTL_SECONDS = 3600;
  uint256 public constant MAX_QUOTE_SIZE_USD = 1_000e6;
  // Clearly labelled deterministic DEMO reference inputs, never an oracle.
  uint256 public constant DEMO_USDC_PRICE_USD8 = 1e8;
  uint256 public constant DEMO_WETH_PRICE_USD8 = 3421e8;
  uint256 public constant DEMO_DEBT_AMOUNT_USDC = 1_000e6;

  function generateQuote(
    bytes32 opportunityId,
    ILendingAdapter.Position memory position,
    address /* maker */,
    bytes32 /* strategyHash */
  ) external view returns (bytes32 quoteId, uint256 price, uint256 size, uint256 minCollateralOut, uint64 expiry, bool execute) {
    quoteId = opportunityId;
    price = DEFAULT_DISCOUNT_BPS;
    size = DEMO_DEBT_AMOUNT_USDC;
    minCollateralOut = QuoteMath.minCollateralOut(size, 6, 18, DEMO_USDC_PRICE_USD8, DEMO_WETH_PRICE_USD8, price);
    expiry = uint64(block.timestamp + QUOTE_TTL_SECONDS);
    execute = position.healthFactor < 1e18 && position.healthFactor > 0;
  }
}
