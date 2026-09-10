// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILendingAdapter} from "./ILendingAdapter.sol";

interface IQuoteSource {
  struct Quote {
    bytes32 quoteId;
    uint256 price;
    uint256 size;
    uint256 minCollateralOut;
    uint64 expiry;
    bool execute;
    bool consumed;
  }

  event QuoteGenerated(
    bytes32 indexed quoteId,
    uint256 price,
    uint256 size,
    uint256 minCollateralOut,
    uint64 expiry,
    bool execute
  );

  function generateQuote(
    bytes32 opportunityId,
    ILendingAdapter.Position memory position,
    address maker,
    bytes32 strategyHash
  ) external returns (bytes32 quoteId, uint256 price, uint256 size, uint256 minCollateralOut, uint64 expiry, bool execute);
}
