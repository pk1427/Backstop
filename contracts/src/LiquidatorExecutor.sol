// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Aqua} from "@aqua/src/Aqua.sol";
import {IAqua} from "@aqua/src/interfaces/IAqua.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IBackstopTaker, LiquidationBackstopApp} from "./LiquidationBackstopApp.sol";
import {ILendingAdapter} from "./interfaces/ILendingAdapter.sol";

/// @title LiquidatorExecutor - Executes liquidation and pushes WETH back to maker
/// @notice Implements IBackstopTaker callback to receive USDC, call liquidation, and push WETH
contract LiquidatorExecutor is IBackstopTaker, ReentrancyGuard {
    error UnauthorizedTrigger();
    error SwapFailed(bytes32 reason);
    error BorrowerRequired();

    event LiquidationRequested(address indexed liquidator, bytes32 indexed strategyHash, bytes32 quoteId, address indexed borrower);
    event LiquidationCompleted(address indexed liquidator, bytes32 indexed strategyHash, uint256 settledSize);
    event LiquidationFailed(address indexed liquidator, bytes32 indexed strategyHash, bytes revertData);
    event LiquidationCalled(address indexed pool, address indexed borrower, uint256 debtRepaid, uint256 collateralSeized);
    event WETHPushed(address indexed maker, uint256 wethAmount);

    IAqua public immutable aqua;
    ILendingAdapter public immutable lendingAdapter;
    address public immutable backstopApp;

    constructor(IAqua aqua_, ILendingAdapter adapter_, address backstopApp_) {
        require(address(aqua_) != address(0) && address(adapter_) != address(0) && backstopApp_ != address(0), "Zero address");
        aqua = aqua_;
        lendingAdapter = adapter_;
        backstopApp = backstopApp_;
    }

    function execute(
        bytes32 strategyHash,
        LiquidationBackstopApp.Strategy calldata strategy,
        bytes32 quoteId,
        address borrower,
        uint256 expectedWethOut
    ) external nonReentrant returns (uint256) {
        if (borrower == address(0)) revert BorrowerRequired();

        emit LiquidationRequested(msg.sender, strategyHash, quoteId, borrower);

        bytes memory takerData = abi.encode(borrower, expectedWethOut);

        uint256 settled;
        try this._callBackstopSwap(strategyHash, strategy, quoteId, takerData) returns (uint256 result) {
            settled = result;
        } catch (bytes memory reason) {
            emit LiquidationFailed(msg.sender, strategyHash, reason);
            revert SwapFailed(bytes32(reason));
        }

        emit LiquidationCompleted(msg.sender, strategyHash, settled);
        return settled;
    }

    function _callBackstopSwap(
        bytes32 strategyHash,
        LiquidationBackstopApp.Strategy calldata strategy,
        bytes32 quoteId,
        bytes calldata takerData
    ) external returns (uint256) {
        require(msg.sender == address(this), "Only executor");
        return LiquidationBackstopApp(backstopApp).swap(strategyHash, strategy, quoteId, takerData);
    }

    function backstopCallback(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint256 minCollateralOut,
        address maker,
        address app,
        bytes32 strategyHash,
        bytes calldata takerData
    ) external override {
        (address borrower, uint256 expectedWethOut) = abi.decode(takerData, (address, uint256));
        require(msg.sender == backstopApp && app == backstopApp, "Unauthorized callback");
        require(tokenIn == lendingAdapter.collateralAsset(borrower), "Unexpected collateral");
        require(tokenOut == lendingAdapter.debtAsset(borrower), "Unexpected debt asset");

        address debtToken = lendingAdapter.debtAsset(borrower);
        if (debtToken.code.length > 0) {
            IERC20(debtToken).approve(address(lendingAdapter), amountOut);
        }

        uint256 wethReceived = lendingAdapter.liquidationCall(
            lendingAdapter.collateralAsset(borrower),
            lendingAdapter.debtAsset(borrower),
            borrower,
            amountOut,
            false
        );

        emit LiquidationCalled(address(lendingAdapter), borrower, amountOut, wethReceived);

        require(wethReceived >= minCollateralOut, "Insufficient collateral output");
        require(wethReceived >= expectedWethOut, "Insufficient WETH from liquidation");
        IERC20(tokenIn).approve(address(aqua), wethReceived);
        aqua.push(maker, app, strategyHash, tokenIn, wethReceived);

        emit WETHPushed(maker, wethReceived);
    }
}

/// @title MockLendingPool - Minimal Aave-fork-compatible lending pool mock
contract MockLendingPool {
    using SafeERC20 for IERC20;

    event Liquidation(address indexed borrower, uint256 debtRepaid, uint256 collateralSeized);

    mapping(address => uint256) public borrowerCollateral;
    mapping(address => uint256) public borrowerDebt;
    IERC20 public weth;

    constructor(IERC20 _weth) {
        weth = _weth;
    }

    function fundBorrower(address borrower, uint256 collateral, uint256 debt) external {
        borrowerCollateral[borrower] = collateral;
        borrowerDebt[borrower] = debt;
    }

    function liquidationCall(address borrower, uint256 debtToRepay) external returns (uint256) {
        require(borrowerDebt[borrower] >= debtToRepay, "Debt too small");
        uint256 collateralToSeize = debtToRepay;
        require(borrowerCollateral[borrower] >= collateralToSeize, "Insufficient collateral");

        borrowerDebt[borrower] -= debtToRepay;
        borrowerCollateral[borrower] -= collateralToSeize;

        weth.safeTransferFrom(borrower, msg.sender, collateralToSeize);

        emit Liquidation(borrower, debtToRepay, collateralToSeize);
        return collateralToSeize;
    }

    function healthFactor(address borrower) external view returns (uint256) {
        if (borrowerDebt[borrower] == 0) return type(uint256).max;
        return (borrowerCollateral[borrower] * 1e18) / borrowerDebt[borrower];
    }
}
