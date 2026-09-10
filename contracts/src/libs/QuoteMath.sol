// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Unit-safe quote economics. Prices are USD per whole token with 8 decimals.
library QuoteMath {
    error InvalidPrice();
    error InvalidDiscount();
    error InvalidDecimals();

    uint256 internal constant BPS = 10_000;

    /// @notice Minimum collateral owed at a discounted execution price, rounded down.
    /// @dev debtAmount is debt-token raw units; returned value is collateral-token raw units.
    /// Formula: floor(debtAmount * debtPrice * 10^collateralDecimals * BPS /
    /// (10^debtDecimals * collateralPrice * (BPS - discountBps))).
    function minCollateralOut(
        uint256 debtAmount,
        uint8 debtDecimals,
        uint8 collateralDecimals,
        uint256 debtPriceUsd8,
        uint256 collateralPriceUsd8,
        uint256 discountBps
    ) internal pure returns (uint256) {
        if (debtPriceUsd8 == 0 || collateralPriceUsd8 == 0) revert InvalidPrice();
        if (discountBps >= BPS) revert InvalidDiscount();
        if (debtDecimals > 18 || collateralDecimals > 18) revert InvalidDecimals();
        // One mulDiv preserves precision until the required final floor.
        return Math.mulDiv(debtAmount, debtPriceUsd8 * (10 ** collateralDecimals) * BPS,
            (10 ** debtDecimals) * collateralPriceUsd8 * (BPS - discountBps));
    }

    /// @notice Expected Aave seizure using its reserve liquidation bonus, rounded down.
    function collateralFromLiquidationBonus(
        uint256 debtAmount, uint8 debtDecimals, uint8 collateralDecimals,
        uint256 debtPriceUsd8, uint256 collateralPriceUsd8, uint256 liquidationBonusBps
    ) internal pure returns (uint256) {
        if (debtPriceUsd8 == 0 || collateralPriceUsd8 == 0) revert InvalidPrice();
        if (debtDecimals > 18 || collateralDecimals > 18) revert InvalidDecimals();
        return Math.mulDiv(debtAmount, debtPriceUsd8 * (10 ** collateralDecimals) * liquidationBonusBps,
            (10 ** debtDecimals) * collateralPriceUsd8 * BPS);
    }
}
