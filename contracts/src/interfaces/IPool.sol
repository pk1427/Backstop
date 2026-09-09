pragma solidity ^0.8.20;

import "./IERC20.sol";

interface IPool {
  struct UserPosition {
    uint256 collateralBalance;
    uint256 debtBalance;
    uint256 healthFactor;
  }

  function liquidationCall(
    address collateralAsset,
    address debtAsset,
    address user,
    uint256 debtToCover,
    bool receiveAToken
  ) external payable returns (uint256);
}
