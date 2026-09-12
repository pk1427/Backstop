// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Controlled USD oracle for the Backstop integration environment.
/// @dev Prices use 8 decimals, matching common Chainlink feeds. This contract
/// must only be used on a dedicated test deployment, never for production funds.
contract MockPriceOracle {
    address public owner;
    mapping(address => uint256) private prices;

    event PriceUpdated(address indexed asset, uint256 previousPrice, uint256 newPrice);

    error NotOwner();
    error InvalidPrice();

    constructor(address owner_) {
        owner = owner_;
    }

    function setPrice(address asset, uint256 price) external {
        if (msg.sender != owner) revert NotOwner();
        if (price == 0) revert InvalidPrice();
        uint256 previous = prices[asset];
        prices[asset] = price;
        emit PriceUpdated(asset, previous, price);
    }

    function getAssetPrice(address asset) external view returns (uint256) {
        uint256 price = prices[asset];
        if (price == 0) revert InvalidPrice();
        return price;
    }
}
