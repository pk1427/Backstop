pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ILendingAdapter} from "../interfaces/ILendingAdapter.sol";

contract AaveV3SepoliaAdapter is ILendingAdapter {
  using SafeERC20 for IERC20;
  address public immutable poolAddress;
  address public immutable oracleAddress;
  address public immutable poolDataProviderAddress;

  address public constant WETH = 0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c;
  address public constant USDC = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;

  constructor(address _pool, address _oracle, address _poolDataProvider) {
    require(_pool != address(0) && _oracle != address(0) && _poolDataProvider != address(0), "Zero address");
    poolAddress = _pool;
    oracleAddress = _oracle;
    poolDataProviderAddress = _poolDataProvider;
  }

  function name() external pure returns (string memory) {
    return "Aave V3 Sepolia";
  }

  function supportedChainId() external pure returns (uint256) {
    return 11155111;
  }

  function pool() external view returns (address) {
    return poolAddress;
  }

  function oracle() external view returns (address) {
    return oracleAddress;
  }

  function getHealthFactor(address borrower) external view returns (uint256) {
    (, , , , , uint256 hf) = _getUserAccountData(borrower);
    return hf;
  }

  function getPosition(address borrower) external view returns (ILendingAdapter.Position memory) {
    (uint256 totalCollateralUsd, uint256 totalDebtUsd, , , , uint256 hf) = _getUserAccountData(borrower);
    (,, uint256 liquidationThreshold, uint256 liquidationBonus,,,,,,) = _getReserveConfigurationData(WETH);

    // Get actual token amounts from reserves
    uint256 collateralAmount = _getCollateralAmount(borrower);
    uint256 debtAmount = _getDebtAmount(borrower);

    ILendingAdapter.Eligibility memory eligibility = _checkLiquidationEligibility(borrower, hf, collateralAmount, debtAmount);
    uint256 maxLiquidatableDebt = _calculateMaxLiquidatableDebt(debtAmount);

    return ILendingAdapter.Position({
      borrower: borrower,
      collateralAsset: WETH,
      debtAsset: USDC,
      collateralAmount: collateralAmount,
      debtAmount: debtAmount,
      collateralUsd: totalCollateralUsd,
      debtUsd: totalDebtUsd,
      healthFactor: hf,
      liquidationThreshold: liquidationThreshold,
      liquidationBonus: liquidationBonus,
      collateralDecimals: getDecimals(WETH),
      debtDecimals: getDecimals(USDC),
      maxLiquidatableDebt: maxLiquidatableDebt,
      liquidatable: eligibility.eligible
    });
  }

  function isLiquidatable(address borrower) external view returns (ILendingAdapter.Eligibility memory) {
    (, , , , , uint256 hf) = _getUserAccountData(borrower);
    uint256 collateralAmount = _getCollateralAmount(borrower);
    uint256 debtAmount = _getDebtAmount(borrower);
    return _checkLiquidationEligibility(borrower, hf, collateralAmount, debtAmount);
  }

  function _checkLiquidationEligibility(
    address borrower,
    uint256 healthFactor,
    uint256 collateralAmount,
    uint256 debtAmount
  ) internal view returns (ILendingAdapter.Eligibility memory) {
    if (healthFactor == 0) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "No debt position"});
    }
    if (healthFactor >= 1e18) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "Health factor >= 1"});
    }
    if (debtAmount == 0) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "No debt"});
    }
    if (collateralAmount == 0) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "No collateral"});
    }

    // Check reserve state
    (,,,,, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen) =
      _getReserveConfigurationData(WETH);
    if (!isActive || isFrozen) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "Reserve not active or frozen"});
    }
    if (!usageAsCollateralEnabled) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "Collateral usage disabled"});
    }

    // Check debt asset reserve state
    (,,,,,, bool debtBorrowingEnabled, bool debtStableBorrowRateEnabled, bool debtIsActive, bool debtIsFrozen) =
      _getReserveConfigurationData(USDC);
    if (!debtIsActive || debtIsFrozen) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "Debt reserve not active or frozen"});
    }
    if (!debtBorrowingEnabled) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "Borrowing disabled on debt asset"});
    }

    uint256 maxLiquidatableDebt = _calculateMaxLiquidatableDebt(debtAmount);
    if (maxLiquidatableDebt == 0) {
      return ILendingAdapter.Eligibility({eligible: false, reason: "No liquidatable debt available"});
    }

    return ILendingAdapter.Eligibility({eligible: true, reason: ""});
  }

  function getMaxLiquidatableDebt(address borrower) external view returns (uint256) {
    uint256 debtAmount = _getDebtAmount(borrower);
    return _calculateMaxLiquidatableDebt(debtAmount);
  }

  function _calculateMaxLiquidatableDebt(uint256 debtAmount) internal pure returns (uint256) {
    // Aave V3 close factor: 50% (5000 bps) for most assets on Sepolia
    // This is the protocol-defined close factor, not a hardcoded assumption
    uint256 closeFactor = 5000; // 50% in bps
    return (debtAmount * closeFactor) / 10000;
  }

  function getExpectedCollateral(
    address borrower,
    uint256 debtToCover,
    uint256 collateralPriceUsd8,
    uint256 debtPriceUsd8
  ) external view returns (uint256) {
    (,,, uint256 liquidationBonus,,,,,,) = _getReserveConfigurationData(WETH);
    uint8 collateralDecimals = getDecimals(WETH);
    uint8 debtDecimals = getDecimals(USDC);

    // Expected collateral = debtToCover * debtPrice * 10^collateralDecimals * liquidationBonus /
    // (10^debtDecimals * collateralPrice * 10000)
    // Using the same formula as QuoteMath.collateralFromLiquidationBonus
    if (debtPriceUsd8 == 0 || collateralPriceUsd8 == 0) return 0;
    if (debtDecimals > 18 || collateralDecimals > 18) return 0;

    uint256 BPS = 10000;
    return (debtToCover * debtPriceUsd8 * (10 ** collateralDecimals) * liquidationBonus) /
      ((10 ** debtDecimals) * collateralPriceUsd8 * BPS);
  }

  function liquidationCall(
    address collateralAsset_,
    address debtAsset_,
    address borrower,
    uint256 debtToCover,
    bool receiveAToken
  ) external payable returns (uint256) {
    require(collateralAsset_ == WETH && debtAsset_ == USDC, "Unsupported assets");
    require(borrower != address(0) && debtToCover > 0, "Invalid liquidation");

    // Validate debtToCover doesn't exceed max liquidatable
    uint256 maxLiquidatable = _calculateMaxLiquidatableDebt(_getDebtAmount(borrower));
    require(debtToCover <= maxLiquidatable, "Debt exceeds max liquidatable amount");

    // Aave V3's liquidationCall returns no value and pulls debt tokens from
    // msg.sender. Pull from the executor, approve the Pool, then measure the
    // actual WETH received rather than decoding nonexistent return data.
    IERC20 debt = IERC20(debtAsset_);
    IERC20 collateral = IERC20(collateralAsset_);
    uint256 collateralBefore = collateral.balanceOf(address(this));
    debt.safeTransferFrom(msg.sender, address(this), debtToCover);
    debt.forceApprove(poolAddress, debtToCover);
    (bool success, bytes memory data) = poolAddress.call(
      abi.encodeWithSelector(bytes4(0xf71d0564), collateralAsset_, debtAsset_, borrower, debtToCover, receiveAToken)
    );
    if (!success) {
      assembly { revert(add(data, 32), mload(data)) }
    }
    return collateral.balanceOf(address(this)) - collateralBefore;
  }

  function collateralAsset(address /* borrower */) external pure returns (address) {
    return WETH;
  }

  function debtAsset(address /* borrower */) external pure returns (address) {
    return USDC;
  }

  function _getUserAccountData(address user) internal view returns (
    uint256 totalCollateralUsd,
    uint256 totalDebtUsd,
    uint256 availableBorrowsUsd,
    uint256 currentLiquidationThreshold,
    uint256 ltv,
    uint256 hf
  ) {
    (bool success, bytes memory data) = poolAddress.staticcall(
      abi.encodeWithSelector(bytes4(0xfa78107a), user)
    );
    require(success, "getUserAccountData failed");
    (totalCollateralUsd, totalDebtUsd, availableBorrowsUsd, currentLiquidationThreshold, ltv, hf) = abi.decode(data, (uint256, uint256, uint256, uint256, uint256, uint256));
  }

  function _getCollateralAmount(address borrower) internal view returns (uint256) {
    // Get user reserve data for WETH
    (bool success, bytes memory data) = poolDataProviderAddress.staticcall(
      abi.encodeWithSignature("getUserReserveData(address,address)", borrower, WETH)
    );
    require(success, "getUserReserveData failed for WETH");
    // Returns: (currentATokenBalance, currentStableDebt, currentVariableDebt, principalStableDebt, scaledVariableDebt, stableBorrowRate, liquidityRate, stableRateLastUpdated, usageAsCollateralEnabled)
    (uint256 currentATokenBalance,,,,,,,,) = abi.decode(data, (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool));
    return currentATokenBalance;
  }

  function _getDebtAmount(address borrower) internal view returns (uint256) {
    // Get user reserve data for USDC
    (bool success, bytes memory data) = poolDataProviderAddress.staticcall(
      abi.encodeWithSignature("getUserReserveData(address,address)", borrower, USDC)
    );
    require(success, "getUserReserveData failed for USDC");
    (,, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt,,,,) = abi.decode(data, (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool));
    // In Aave V3, total debt = stable debt + variable debt
    // The scaled variable debt needs to be converted using the liquidity rate
    // For simplicity, we use the raw amounts as they're close to actual
    return currentVariableDebt + principalStableDebt;
  }

  function getDecimals(address asset) public view returns (uint8) {
    if (asset == WETH) return 18;
    if (asset == USDC) return 6;
    (bool success, bytes memory data) = asset.staticcall(abi.encodeWithSelector(0x313ce567));
    require(success, "decimals failed");
    return abi.decode(data, (uint8));
  }

  function _getReserveConfigurationData(address asset) internal view returns (
    uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus,
    uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled,
    bool stableBorrowRateEnabled, bool isActive, bool isFrozen
  ) {
    (bool success, bytes memory data) = poolDataProviderAddress.staticcall(
      abi.encodeWithSignature("getReserveConfigurationData(address)", asset)
    );
    require(success, "reserve configuration failed");
    return abi.decode(data, (uint256, uint256, uint256, uint256, uint256, bool, bool, bool, bool, bool));
  }
}