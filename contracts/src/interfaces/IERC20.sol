pragma solidity ^0.8.20;

interface IERC20 {
  function balanceOf(address account) external view returns (uint256);
  function decimals() external view returns (uint8);
  function symbol() external view returns (string memory);
}
