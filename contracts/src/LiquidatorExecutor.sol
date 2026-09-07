// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Aqua} from "@aqua/src/Aqua.sol";
import {IAqua} from "@aqua/src/interfaces/IAqua.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IBackstopTaker} from "./LiquidationBackstopApp.sol";

/// @title LiquidatorExecutor - Executes liquidation and pushes WETH back to maker
/// @notice Implements IBackstopTaker callback to receive USDC, call liquidation, and push WETH
contract LiquidatorExecutor is IBackstopTaker {
    event LiquidationCalled(address indexed pool, address indexed borrower, uint256 debtRepaid, uint256 collateralSeized);
    event WETHPushed(address indexed maker, uint256 wethAmount);

    IAqua public immutable aqua;
    MockLendingPool public immutable lendingPool;

    constructor(IAqua aqua_, MockLendingPool pool_) {
        aqua = aqua_;
        lendingPool = pool_;
    }

    /// @notice Callback after USDC is pulled from maker
    /// @dev Receives USDC, calls liquidation, pushes WETH back to maker
    function backstopCallback(
        address tokenIn,
        address /* tokenOut */,
        uint256 amountOut,
        address maker,
        address app,
        bytes32 strategyHash,
        bytes calldata takerData
    ) external override {
        // Decode liquidation params from takerData
        (address borrower, uint256 expectedWethOut) = abi.decode(takerData, (address, uint256));

        // Call mock Aave liquidation using the pulled USDC
        uint256 wethReceived = lendingPool.liquidationCall(borrower, amountOut);

        emit LiquidationCalled(address(lendingPool), borrower, amountOut, wethReceived);

        // Push the resulting WETH back to maker
        require(wethReceived >= expectedWethOut, "Insufficient WETH from liquidation");
        IERC20(tokenIn).approve(address(aqua), wethReceived);
        aqua.push(maker, app, strategyHash, tokenIn, wethReceived);

        emit WETHPushed(maker, wethReceived);
    }
}

/// @title MockLendingPool - Minimal Aave-fork-compatible lending pool mock
contract MockLendingPool {
    event Liquidation(address indexed borrower, uint256 debtRepaid, uint256 collateralSeized);

    mapping(address => uint256) public borrowerCollateral;
    mapping(address => uint256) public borrowerDebt;

    function fundBorrower(address borrower, uint256 collateral, uint256 debt) external {
        borrowerCollateral[borrower] = collateral;
        borrowerDebt[borrower] = debt;
    }

    /// @notice Simulate Aave liquidationCall
    /// @param borrower The borrower to liquidate
    /// @param debtToRepay The amount of debt to repay
    /// @return collateralSeized The amount of WETH collateral seized
    function liquidationCall(address borrower, uint256 debtToRepay) external returns (uint256) {
        require(borrowerDebt[borrower] >= debtToRepay, "Debt too small");
        uint256 collateralToSeize = debtToRepay; // 1:1 for simplicity
        require(borrowerCollateral[borrower] >= collateralToSeize, "Insufficient collateral");

        borrowerDebt[borrower] -= debtToRepay;
        borrowerCollateral[borrower] -= collateralToSeize;

        emit Liquidation(borrower, debtToRepay, collateralToSeize);
        return collateralToSeize;
    }

    /// @notice Calculate health factor for a borrower
    function healthFactor(address borrower) external view returns (uint256) {
        if (borrowerDebt[borrower] == 0) return type(uint256).max;
        return (borrowerCollateral[borrower] * 1e18) / borrowerDebt[borrower];
    }
}
