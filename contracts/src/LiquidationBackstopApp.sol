// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Aqua} from "@aqua/src/Aqua.sol";
import {AquaApp} from "@aqua/src/AquaApp.sol";
import {IAqua} from "@aqua/src/interfaces/IAqua.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {QuoteRegistry} from "./QuoteRegistry.sol";

/// @title LiquidationBackstopApp - Custom AquaApp for confidential liquidation backstop
/// @notice Maker ships USDC (output leg). Taker pulls USDC, calls liquidation, pushes WETH (input leg) back to maker.
/// @dev USDC is the maker's OUTPUT leg (pulled FROM the maker). WETH is the maker's INPUT leg (pushed TO the maker).
contract LiquidationBackstopApp is AquaApp, Ownable {
    error InvalidStrategy();
    error QuoteExpired();
    error QuoteTooLarge();
    error QuotePriceOutOfBounds();
    error UnauthorizedQuoteWriter();
    error QuoteAlreadyConsumed();
    error UnauthorizedExecutor();
    error ExecutorAlreadySet();

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
    address public executor;

    constructor(IAqua aqua_, QuoteRegistry quoteRegistry_) AquaApp(aqua_) Ownable(msg.sender) {
        require(address(aqua_) != address(0) && address(quoteRegistry_) != address(0), "Zero address");
        quoteRegistry = quoteRegistry_;
    }

    /// @notice Permanently binds settlement to one audited callback executor.
    /// @dev This is set after deploying the app because the executor itself needs the app address.
    function setExecutor(address executor_) external onlyOwner {
        if (executor != address(0)) revert ExecutorAlreadySet();
        if (executor_ == address(0)) revert UnauthorizedExecutor();
        executor = executor_;
    }

    /// @notice Execute a swap with quote validation
    /// @param strategyHash The hash of the shipped strategy
    /// @param strategy The strategy struct with immutable bounds
    /// @param quoteId The quote ID to validate against
    /// @param takerData Arbitrary data passed to the callback (e.g., liquidation params)
    function swap(bytes32 strategyHash, Strategy calldata strategy, bytes32 quoteId, bytes calldata takerData) external nonReentrantStrategy(strategy.maker, strategyHash) returns (uint256) {
        if (msg.sender != executor) revert UnauthorizedExecutor();
        // Aqua stores the hash, not strategy bytes. Bind every execution-time field
        // back to the immutable strategy the maker shipped.
        if (keccak256(abi.encode(strategy)) != strategyHash) revert InvalidStrategy();
        if (strategy.maker == address(0) || strategy.tokenIn == address(0) || strategy.tokenOut == address(0)
            || strategy.tokenIn == strategy.tokenOut || strategy.maxTrade == 0
            || strategy.minDiscountBps > strategy.maxDiscountBps || block.timestamp > strategy.expiry) {
            revert InvalidStrategy();
        }
        // Read quote from production QuoteRegistry
        QuoteRegistry.Quote memory registryQuote = quoteRegistry.getQuote(quoteId);

        // Validate quote exists and is executable
        require(registryQuote.execute, "Quote not executable");
        require(!quoteRegistry.quoteConsumed(quoteId), "Quote already consumed");

        // Validate quote expiry
        require(block.timestamp <= registryQuote.expiry, "Quote expired");

        uint256 quotedSize = registryQuote.size;
        require(quotedSize > 0 && quotedSize <= strategy.maxTrade, "Quote size exceeds maxTrade");

        // Validate price within discount bounds
        // price is expressed as a percentage: e.g., 100 = 1% discount, 500 = 5% discount
        require(registryQuote.price >= strategy.minDiscountBps, "Price below min discount");
        require(registryQuote.price <= strategy.maxDiscountBps, "Price above max discount");

        emit QuoteValidated(strategyHash, quoteId, registryQuote.price, quotedSize);

        // Pull USDC (maker's output leg) from maker to taker
        AQUA.pull(strategy.maker, strategyHash, strategy.tokenOut, quotedSize, msg.sender);

        // Call taker callback - taker must push WETH back
        IBackstopTaker(msg.sender).backstopCallback(strategy.tokenIn, strategy.tokenOut, quotedSize, registryQuote.minCollateralOut, strategy.maker, address(this), strategyHash, takerData);

        // Verify taker pushed enough WETH
        // Compatible-unit settlement invariant: WETH raw units against a WETH raw minimum.
        _safeCheckAquaPush(strategy.maker, strategyHash, strategy.tokenIn, registryQuote.minCollateralOut);

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
        uint256 minCollateralOut,
        address maker,
        address app,
        bytes32 strategyHash,
        bytes calldata takerData
    ) external;
}
