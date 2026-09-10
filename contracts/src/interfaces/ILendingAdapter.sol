pragma solidity ^0.8.20;

interface ILendingAdapter {
  struct Position {
    address borrower;
    address collateralAsset;
    address debtAsset;
    uint256 collateralAmount;
    uint256 debtAmount;
    uint256 collateralUsd;
    uint256 debtUsd;
    uint256 healthFactor;
    uint256 liquidationThreshold;
    uint256 liquidationBonus;
    uint256 collateralDecimals;
    uint256 debtDecimals;
    uint256 maxLiquidatableDebt;
    bool liquidatable;
  }

  struct Eligibility {
    bool eligible;
    string reason;
  }

  function name() external view returns (string memory);

  function supportedChainId() external view returns (uint256);

  function pool() external view returns (address);

  function oracle() external view returns (address);

  function getHealthFactor(address borrower) external view returns (uint256);

  function getPosition(address borrower) external view returns (Position memory);

  function isLiquidatable(address borrower) external view returns (Eligibility memory);

  function liquidationCall(
    address collateralAsset,
    address debtAsset,
    address borrower,
    uint256 debtToCover,
    bool receiveAToken
  ) external payable returns (uint256);

  function collateralAsset(address borrower) external view returns (address);

  function debtAsset(address borrower) external view returns (address);

  function getMaxLiquidatableDebt(address borrower) external view returns (uint256);

  function getExpectedCollateral(
    address borrower,
    uint256 debtToCover,
    uint256 collateralPriceUsd8,
    uint256 debtPriceUsd8
  ) external view returns (uint256);
}
