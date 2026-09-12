// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILendingAdapter} from "../interfaces/ILendingAdapter.sol";
import {PriceAwareMockLendingPool} from "../mocks/PriceAwareMockLendingPool.sol";
import {MockPriceOracle} from "../mocks/MockPriceOracle.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice ILendingAdapter for the price-aware controlled integration market.
contract PriceAwareMockLendingPoolAdapter is ILendingAdapter {
    using SafeERC20 for IERC20;

    PriceAwareMockLendingPool public immutable lendingPool;
    MockPriceOracle public immutable priceOracle;
    address public immutable debtToken;
    address public immutable collateralToken;

    constructor(PriceAwareMockLendingPool pool_, address debtToken_, address collateralToken_, MockPriceOracle oracle_) {
        lendingPool = pool_;
        debtToken = debtToken_;
        collateralToken = collateralToken_;
        priceOracle = oracle_;
    }

    function name() external pure returns (string memory) { return "Price-aware Mock Lending Pool"; }
    function supportedChainId() external pure returns (uint256) { return 11155111; }
    function pool() external view returns (address) { return address(lendingPool); }
    function oracle() external view returns (address) { return address(priceOracle); }
    function getHealthFactor(address borrower) external view returns (uint256) { return lendingPool.healthFactor(borrower); }

    function getPosition(address borrower) external view returns (ILendingAdapter.Position memory position) {
        uint256 collateral = lendingPool.borrowerCollateral(borrower);
        uint256 debt = lendingPool.borrowerDebt(borrower);
        uint256 hf = lendingPool.healthFactor(borrower);
        uint256 debtUsd8 = debt * 1e8 / (10 ** IERC20Metadata(debtToken).decimals());
        uint256 collateralUsd8 = collateral * priceOracle.getAssetPrice(collateralToken) / 1e18;
        position = ILendingAdapter.Position({
            borrower: borrower, collateralAsset: collateralToken, debtAsset: debtToken,
            collateralAmount: collateral, debtAmount: debt, collateralUsd: collateralUsd8,
            debtUsd: debtUsd8, healthFactor: hf, liquidationThreshold: 8500,
            liquidationBonus: 10500, collateralDecimals: 18,
            debtDecimals: IERC20Metadata(debtToken).decimals(),
            maxLiquidatableDebt: debt * 5000 / 10000, liquidatable: hf < 1e18 && debt > 0 && collateral > 0
        });
    }

    function isLiquidatable(address borrower) external view returns (ILendingAdapter.Eligibility memory) {
        uint256 hf = lendingPool.healthFactor(borrower);
        if (lendingPool.borrowerDebt(borrower) == 0) return ILendingAdapter.Eligibility(false, "No debt");
        if (hf >= 1e18) return ILendingAdapter.Eligibility(false, "Health factor >= 1");
        return ILendingAdapter.Eligibility(true, "");
    }

    function getMaxLiquidatableDebt(address borrower) external view returns (uint256) {
        return lendingPool.borrowerDebt(borrower) * 5000 / 10000;
    }

    function getExpectedCollateral(address, uint256 debtToCover, uint256, uint256) external view returns (uint256) {
        uint256 debtUsd8 = debtToCover * 1e8 / (10 ** IERC20Metadata(debtToken).decimals());
        return debtUsd8 * 10500 * 1e18 / (priceOracle.getAssetPrice(collateralToken) * 10000);
    }

    function liquidationCall(address, address, address borrower, uint256 debtToCover, bool) external payable returns (uint256) {
        IERC20(debtToken).safeTransferFrom(msg.sender, address(this), debtToCover);
        IERC20(debtToken).forceApprove(address(lendingPool), debtToCover);
        uint256 seized = lendingPool.liquidationCall(borrower, debtToCover);
        IERC20(collateralToken).safeTransfer(msg.sender, seized);
        return seized;
    }

    function collateralAsset(address) external view returns (address) { return collateralToken; }
    function debtAsset(address) external view returns (address) { return debtToken; }
}
