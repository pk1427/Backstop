// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Aqua} from "@aqua/src/Aqua.sol";
import {AquaApp} from "@aqua/src/AquaApp.sol";
import {IAqua} from "@aqua/src/interfaces/IAqua.sol";
import {QuoteRegistry} from "./QuoteRegistry.sol";

/// @title LiquidationBackstopApp - Custom AquaApp for confidential liquidation backstop
/// @notice Maker ships USDC (output leg). Taker pulls USDC, calls liquidation, pushes WETH (input leg) back to maker.
/// @dev USDC is the maker's OUTPUT leg (pulled FROM the maker). WETH is the maker's INPUT leg (pushed TO the maker).
contract LiquidationBackstopApp is AquaApp {
    error InvalidStrategy();
    error QuoteExpired();
    error QuoteTooLarge();
    error QuotePriceOutOfBounds();
    error UnauthorizedQuoteWriter();
    error QuoteAlreadyConsumed();

    event StrategyShipped(bytes32 indexed strategyHash, address indexed maker, address tokenIn, address tokenOut, uint256 maxTrade, uint16 minDiscountBps, uint16 maxDiscountBps, uint64 expiry);
    event QuoteValidated(bytes32 indexed strategyHash, bytes32 indexed quoteId, uint256 price, uint256 size);
    event SwapExecuted(bytes32 indexed strategyHash, address indexed maker, uint256 usdcPulled, uint256 wethPushed);

    struct Strategy {
        address maker;
        address tokenIn;   // WETH (maker's input/push leg)
        address tokenOut;  // USDC (maker's output/pull leg)
        uint256 maxTrade;
        uint16  minDiscountBps;
        uint16  maxDiscountBps;
        uint64  expiry;
        bytes32 salt;
    }

    struct Quote {
        uint256 price;
        uint256 size;
        uint64  expiry;
        bool    valid;
    }

    // Production quote source: CRE-delivered QuoteRegistry
    QuoteRegistry public immutable quoteRegistry;

    constructor(IAqua aqua_, QuoteRegistry quoteRegistry_) AquaApp(aqua_) {
        quoteRegistry = quoteRegistry_;
    }

    /// @notice Execute a swap with quote validation
    /// @param strategyHash The hash of the shipped strategy
    /// @param strategy The strategy struct with immutable bounds
    /// @param quoteId The quote ID to validate against
    /// @param takerData Arbitrary data passed to the callback (e.g., liquidation params)
    function swap(bytes32 strategyHash, Strategy calldata strategy, bytes32 quoteId, bytes calldata takerData) external nonReentrantStrategy(strategy.maker, strategyHash) returns (uint256) {
        // Read quote from production QuoteRegistry
        QuoteRegistry.Quote memory registryQuote = quoteRegistry.getQuote(quoteId);

        // Validate quote exists and is executable
        require(registryQuote.execute, "Quote not executable");
        require(!quoteRegistry.quoteConsumed(quoteId), "Quote already consumed");

        // Validate quote expiry
        require(block.timestamp <= registryQuote.expiry, "Quote expired");

        uint256 quotedSize = registryQuote.size;
        require(quotedSize <= strategy.maxTrade, "Quote size exceeds maxTrade");

        // Validate price within discount bounds
        // price is expressed as a percentage: e.g., 100 = 1% discount, 500 = 5% discount
        require(registryQuote.price >= strategy.minDiscountBps, "Price below min discount");
        require(registryQuote.price <= strategy.maxDiscountBps, "Price above max discount");

        emit QuoteValidated(strategyHash, quoteId, registryQuote.price, quotedSize);

        // Pull USDC (maker's output leg) from maker to taker
        AQUA.pull(strategy.maker, strategyHash, strategy.tokenOut, quotedSize, msg.sender);

        // Call taker callback - taker must push WETH back
        IBackstopTaker(msg.sender).backstopCallback(strategy.tokenIn, strategy.tokenOut, quotedSize, strategy.maker, address(this), strategyHash, takerData);

        // Verify taker pushed enough WETH
        _safeCheckAquaPush(strategy.maker, strategyHash, strategy.tokenIn, quotedSize);

        // Mark quote as consumed to prevent replay
        quoteRegistry.consumeQuote(quoteId);

        emit SwapExecuted(strategyHash, strategy.maker, quotedSize, quotedSize);
        return quotedSize;
    }
}

/// @title IBackstopTaker - Callback interface for LiquidationBackstopApp
/// @notice The callback is invoked after the output tokens (USDC) are sent but before input validation (WETH push)
interface IBackstopTaker {
    function backstopCallback(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        address maker,
        address app,
        bytes32 strategyHash,
        bytes calldata takerData
    ) external;
}
