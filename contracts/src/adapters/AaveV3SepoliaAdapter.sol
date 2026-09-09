pragma solidity ^0.8.20;

import {ILendingAdapter} from "../interfaces/ILendingAdapter.sol";

contract AaveV3SepoliaAdapter is ILendingAdapter {
  address public immutable pool;
  address public immutable oracle;
  address public immutable poolDataProvider;

  address public constant WETH = 0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c;
  address public constant USDC = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;

  constructor(address _pool, address _oracle, address _poolDataProvider) {
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
    (uint256 totalCollateralUsd, uint256 totalDebtUsd, uint256 hf, , ) = _getUserAccountData(borrower);

    return ILendingAdapter.Position({
      borrower: borrower,
      collateralAsset: WETH,
      debtAsset: USDC,
      collateralUsd: totalCollateralUsd,
      debtUsd: totalDebtUsd,
      healthFactor: hf,
      liquidationThreshold: 8500,
      liquidationBonus: 10500,
      collateralDecimals: 18,
      debtDecimals: 6
    });
  }

  function isLiquidatable(address borrower) external view returns (bool) {
    (, , uint256 hf, , ) = _getUserAccountData(borrower);
    return hf > 0 && hf < 1e18;
  }

  function getHealthFactor(address borrower) external view returns (uint256) {
    (, , uint256 hf, , ) = _getUserAccountData(borrower);
    return hf;
  }

  function liquidationCall(
    address collateralAsset_,
    address debtAsset_,
    address borrower,
    uint256 debtToCover,
    bool receiveAToken
  ) external payable returns (uint256) {
    (bool success, bytes memory data) = pool.call(
      abi.encodeWithSelector(
        bytes4(0xf71d0564),
        collateralAsset_,
        debtAsset_,
        borrower,
        debtToCover,
        receiveAToken
      )
    );
    require(success, string(data));
    return abi.decode(data, (uint256));
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
    uint256 hf,
    uint256 ltv,
    address[] memory reserves
  ) {
    (bool success, bytes memory data) = pool.staticcall(
      abi.encodeWithSelector(bytes4(0xfa78107a), user)
    );
    require(success, "getUserAccountData failed");
    (totalCollateralUsd, totalDebtUsd, hf, ltv, reserves) = abi.decode(data, (uint256, uint256, uint256, uint256, address[]));
  }

  function getDecimals(address asset) external view returns (uint8) {
    if (asset == WETH) return 18;
    if (asset == USDC) return 6;
    (bool success, bytes memory data) = asset.staticcall(abi.encodeWithSelector(0x313ce567));
    require(success, "decimals failed");
    return abi.decode(data, (uint8));
  }
}
