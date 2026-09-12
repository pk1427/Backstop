// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MockPriceOracle} from "./MockPriceOracle.sol";

/// @notice Controlled lending market for end-to-end Backstop testing.
/// @dev Its only purpose is to demonstrate an oracle price move turning a
/// healthy position liquidatable. It is not an Aave implementation.
contract PriceAwareMockLendingPool {
    using SafeERC20 for IERC20;

    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
    uint256 public constant CLOSE_FACTOR_BPS = 5_000;

    IERC20 public immutable collateralToken;
    IERC20 public immutable debtToken;
    MockPriceOracle public immutable oracle;
    uint8 public immutable debtDecimals;

    mapping(address => uint256) public borrowerCollateral;
    mapping(address => uint256) public borrowerDebt;

    event PositionFunded(address indexed borrower, uint256 collateral, uint256 debt);
    event Liquidation(address indexed borrower, uint256 debtRepaid, uint256 collateralSeized);

    constructor(IERC20 collateralToken_, IERC20 debtToken_, MockPriceOracle oracle_, uint8 debtDecimals_) {
        collateralToken = collateralToken_;
        debtToken = debtToken_;
        oracle = oracle_;
        debtDecimals = debtDecimals_;
    }

    function fundBorrower(address borrower, uint256 collateral, uint256 debt) external {
        borrowerCollateral[borrower] = collateral;
        borrowerDebt[borrower] = debt;
        emit PositionFunded(borrower, collateral, debt);
    }

    function healthFactor(address borrower) public view returns (uint256) {
        uint256 debt = borrowerDebt[borrower];
        if (debt == 0) return type(uint256).max;
        uint256 collateralUsd8 = borrowerCollateral[borrower] * oracle.getAssetPrice(address(collateralToken)) / 1e18;
        uint256 debtUsd8 = debt * 1e8 / (10 ** debtDecimals);
        return collateralUsd8 * LIQUIDATION_THRESHOLD_BPS * 1e18 / (debtUsd8 * 10_000);
    }

    function maxLiquidatableDebt(address borrower) external view returns (uint256) {
        return borrowerDebt[borrower] * CLOSE_FACTOR_BPS / 10_000;
    }

    function liquidationCall(address borrower, uint256 debtToRepay) external returns (uint256 collateralSeized) {
        require(healthFactor(borrower) < 1e18, "Position healthy");
        require(debtToRepay > 0 && debtToRepay <= borrowerDebt[borrower] * CLOSE_FACTOR_BPS / 10_000, "Invalid debt amount");

        uint256 debtUsd8 = debtToRepay * 1e8 / (10 ** debtDecimals);
        collateralSeized = debtUsd8 * LIQUIDATION_BONUS_BPS * 1e18 /
            (oracle.getAssetPrice(address(collateralToken)) * 10_000);
        require(collateralSeized <= borrowerCollateral[borrower], "Insufficient collateral");

        borrowerDebt[borrower] -= debtToRepay;
        borrowerCollateral[borrower] -= collateralSeized;
        debtToken.safeTransferFrom(msg.sender, address(this), debtToRepay);
        collateralToken.safeTransferFrom(borrower, msg.sender, collateralSeized);
        emit Liquidation(borrower, debtToRepay, collateralSeized);
    }
}
