// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReceiverTemplate} from "./ReceiverTemplate.sol";
import {IReceiver} from "./IReceiver.sol";

/// @title QuoteRegistry - Receives and stores quotes from Chainlink CRE workflows
/// @notice Inherits from ReceiverTemplate to authenticate incoming CRE reports
/// @dev Only the configured Chainlink Forwarder can submit quotes via onReport
contract QuoteRegistry is ReceiverTemplate {
    struct Quote {
        bytes32 quoteId;
        address borrower;
        uint256 price;
        uint256 size;
        // Minimum collateral the maker must receive, in the collateral token's raw units.
        // For WETH this is an 18-decimal quantity, never a USD or USDC value.
        uint256 minCollateralOut;
        uint64  expiry;
        bool    execute;
        bool    consumed;
    }

    mapping(bytes32 => Quote) public quotes;
    mapping(bytes32 => bool) public quoteExists;
    mapping(bytes32 => bool) public quoteConsumed;
    mapping(address => bytes32) public latestQuoteForBorrower;

    event QuoteSubmitted(
        bytes32 indexed quoteId,
        address indexed borrower,
        uint256 price,
        uint256 size,
        uint64 expiry,
        bool execute
    );

    error InvalidQuote();
    error QuoteAlreadyExists();
    error BackstopAppAlreadySet();
    error UnauthorizedBackstopApp();

    address public backstopApp;

    /// @notice Constructor sets the authorized Chainlink Forwarder address
    /// @param _forwarderAddress The address of the Chainlink KeystoneForwarder contract
    constructor(
        address _forwarderAddress
    ) ReceiverTemplate(_forwarderAddress) {}

    /// @notice Permanently authorize the app allowed to consume quotes.
    /// @dev Set after both contracts are deployed; an arbitrary caller must never
    /// be able to invalidate a valid CRE quote.
    function setBackstopApp(address app) external onlyOwner {
        if (backstopApp != address(0)) revert BackstopAppAlreadySet();
        if (app == address(0)) revert UnauthorizedBackstopApp();
        backstopApp = app;
    }

    /// @notice Returns whether a quote ID exists in the registry
    /// @param quoteId The quote ID to check
    /// @return True if the quote exists, false otherwise
    function hasQuote(bytes32 quoteId) external view returns (bool) {
        return quoteExists[quoteId];
    }

    /// @notice Processes an incoming CRE report and stores the quote
    /// @param report The ABI-encoded quote data from the CRE workflow
    /// @dev Called by ReceiverTemplate after forwarder authentication passes
    function _processReport(bytes calldata report) internal override {
        // Decode the application payload
        // Expected layout: (bytes32 quoteId, uint256 price, uint256 size, uint64 expiry, bool execute)
        (bytes32 quoteId, address borrower, uint256 price, uint256 size, uint256 minCollateralOut, uint64 expiry, bool execute) =
            abi.decode(report, (bytes32, address, uint256, uint256, uint256, uint64, bool));

        // Validate quote data
        if (quoteId == bytes32(0) || borrower == address(0)) {
            revert InvalidQuote();
        }

        if (quoteExists[quoteId]) {
            revert QuoteAlreadyExists();
        }

        // Store the quote
        quotes[quoteId] = Quote({
            quoteId: quoteId,
            borrower: borrower,
            price: price,
            size: size,
            minCollateralOut: minCollateralOut,
            expiry: expiry,
            execute: execute,
            consumed: false
        });
        quoteExists[quoteId] = true;
        latestQuoteForBorrower[borrower] = quoteId;

        emit QuoteSubmitted(quoteId, borrower, price, size, expiry, execute);
    }

    /// @notice Returns the quote data for a given quote ID
    /// @param quoteId The quote ID to look up
    /// @return The quote struct
    function getQuote(bytes32 quoteId) external view returns (Quote memory) {
        return quotes[quoteId];
    }

    /// @notice Marks a quote as consumed after successful execution
    /// @dev Only callable by the BackstopApp to prevent double-spending
    function consumeQuote(bytes32 quoteId) external {
        if (msg.sender != backstopApp) revert UnauthorizedBackstopApp();
        require(quoteExists[quoteId], "Quote does not exist");
        require(!quoteConsumed[quoteId], "Quote already consumed");
        quoteConsumed[quoteId] = true;
        quotes[quoteId].consumed = true;
    }
}
