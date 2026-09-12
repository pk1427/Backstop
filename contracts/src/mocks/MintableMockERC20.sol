// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Owner-minted token used only by the controlled integration market.
contract MintableMockERC20 is ERC20 {
    uint8 private immutable tokenDecimals;
    address public immutable owner;

    error NotOwner();

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        owner = msg.sender;
        tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) { return tokenDecimals; }

    function mint(address to, uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        _mint(to, amount);
    }
}
