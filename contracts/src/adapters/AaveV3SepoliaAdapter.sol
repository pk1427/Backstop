pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ILendingAdapter} from "../interfaces/ILendingAdapter.sol";

contract AaveV3SepoliaAdapter is ILendingAdapter {
  using SafeERC20 for IERC20;
  address public immutable pool;
  address public immutable oracle;
  address public immutable poolDataProvider;

  address public constant WETH = 0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c;
  address public constant USDC = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;

  constructor(address _pool, address _oracle, address _poolDataProvider) {
    require(_pool != address(0) && _oracle != address(0) && _poolDataProvider != address(0), "Zero address");
    pool = _pool;
    oracle = _oracle;
    poolDataProvider = _poolDataProvider;
  }

  function name() external pure returns (string memory) {
    return "Aave V3 Sepolia";
  }

  function supportedChainId() external pure returns (uint256) {
    return 11155111;
  }

  function getPosition(address borrower) external view returns (ILendingAdapter.Position memory) {
    (uint256 totalCollateralUsd, uint256 totalDebtUsd, uint256 hf, , , ) = _getUserAccountData(borrower);
    (,, uint256 liquidationThreshold, uint256 liquidationBonus,,,,,,) = _getReserveConfigurationData(WETH);

    return ILendingAdapter.Position({
      borrower: borrower,
      collateralAsset: WETH,
      debtAsset: USDC,
      collateralUsd: totalCollateralUsd,
      debtUsd: totalDebtUsd,
      healthFactor: hf,
      liquidationThreshold: liquidationThreshold,
      liquidationBonus: liquidationBonus,
      collateralDecimals: getDecimals(WETH),
      debtDecimals: getDecimals(USDC)
    });
  }

  function isLiquidatable(address borrower) external view returns (bool) {
    (, , , , , uint256 hf) = _getUserAccountData(borrower);
    return hf > 0 && hf < 1e18;
  }

  function getHealthFactor(address borrower) external view returns (uint256) {
    (, , , , , uint256 hf) = _getUserAccountData(borrower);
    return hf;
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

    // Aave V3's liquidationCall returns no value and pulls debt tokens from
    // msg.sender. Pull from the executor, approve the Pool, then measure the
    // actual WETH received rather than decoding nonexistent return data.
    IERC20 debt = IERC20(debtAsset_);
    IERC20 collateral = IERC20(collateralAsset_);
    uint256 collateralBefore = collateral.balanceOf(address(this));
    debt.safeTransferFrom(msg.sender, address(this), debtToCover);
    debt.forceApprove(pool, debtToCover);
    (bool success, bytes memory data) = pool.call(
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
    (bool success, bytes memory data) = pool.staticcall(
      abi.encodeWithSelector(bytes4(0xfa78107a), user)
    );
    require(success, "getUserAccountData failed");
    (totalCollateralUsd, totalDebtUsd, availableBorrowsUsd, currentLiquidationThreshold, ltv, hf) = abi.decode(data, (uint256, uint256, uint256, uint256, uint256, uint256));
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
    (bool success, bytes memory data) = poolDataProvider.staticcall(
      abi.encodeWithSignature("getReserveConfigurationData(address)", asset)
    );
    require(success, "reserve configuration failed");
    return abi.decode(data, (uint256, uint256, uint256, uint256, uint256, bool, bool, bool, bool, bool));
  }
}
