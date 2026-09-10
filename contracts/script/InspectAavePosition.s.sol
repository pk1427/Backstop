// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {AaveV3SepoliaAdapter} from "../src/adapters/AaveV3SepoliaAdapter.sol";
import {ILendingAdapter} from "../src/interfaces/ILendingAdapter.sol";

/// @title InspectAavePosition - CLI script to inspect live Aave V3 positions on Sepolia
/// @notice Run with: forge script script/InspectAavePosition.s.sol --rpc-url $SEPOLIA_RPC -vvv
/// @dev Accepts borrower address via BORROWER environment variable or hardcoded default
contract InspectAavePosition is Script {
    address public constant AAVE_POOL = 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951;
    address public constant AAVE_ORACLE = 0x2da88497588bf89281816106C7259e31AF45a663;
    address public constant AAVE_POOL_DATA_PROVIDER = 0x3e9708d80f7B3e43118013075F7e95CE3AB31F31;
    address public constant WETH = 0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c;
    address public constant USDC = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;

    // Default borrower for testing (can be overridden via env var)
    address public constant DEFAULT_BORROWER = 0x0000000000000000000000000000000000000000;

    function run() external {
        address borrower = _getBorrower();

        console.log("==========================================");
        console.log("LIVE AAVE V3 SEPOLIA POSITION INSPECTION");
        console.log("==========================================");
        console.log("");

        AaveV3SepoliaAdapter adapter = new AaveV3SepoliaAdapter(
            AAVE_POOL,
            AAVE_ORACLE,
            AAVE_POOL_DATA_PROVIDER
        );

        // Get live prices from Aave oracle
        (uint256 wethPrice, uint256 usdcPrice) = _getLivePrices();

        console.log("ORACLE PRICES (USD per whole token, 8 decimals):");
        console.log("  WETH: $", _formatPrice(wethPrice));
        console.log("  USDC: $", _formatPrice(usdcPrice));
        console.log("");

        // Get position
        ILendingAdapter.Position memory position = adapter.getPosition(borrower);
        ILendingAdapter.Eligibility memory eligibility = adapter.isLiquidatable(borrower);
        uint256 maxLiquidatableDebt = adapter.getMaxLiquidatableDebt(borrower);
        uint256 expectedCollateral = adapter.getExpectedCollateral(
            borrower,
            maxLiquidatableDebt,
            wethPrice,
            usdcPrice
        );

        _printPosition(position, eligibility, maxLiquidatableDebt, expectedCollateral, wethPrice, usdcPrice);
    }

    function _getBorrower() internal view returns (address) {
        // Try to read from environment variable
        string memory borrowerStr = vm.envString("BORROWER");
        if (bytes(borrowerStr).length > 0) {
            return vm.parseAddress(borrowerStr);
        }
        return DEFAULT_BORROWER;
    }

    function _getLivePrices() internal view returns (uint256, uint256) {
        // Get prices from Aave oracle
        // getAssetPrice returns price in WEI (18 decimals) for 1 unit of the asset
        // We need USD with 8 decimals
        (bool wethSuccess, bytes memory wethData) = AAVE_ORACLE.staticcall(
            abi.encodeWithSignature("getAssetPrice(address)", WETH)
        );
        (bool usdcSuccess, bytes memory usdcData) = AAVE_ORACLE.staticcall(
            abi.encodeWithSignature("getAssetPrice(address)", USDC)
        );

        require(wethSuccess, "WETH price fetch failed");
        require(usdcSuccess, "USDC price fetch failed");

        uint256 wethPriceWei = abi.decode(wethData, (uint256));
        uint256 usdcPriceWei = abi.decode(usdcData, (uint256));

        // Convert from 18 decimals to 8 decimals
        uint256 wethPriceUsd8 = wethPriceWei / 1e10;
        uint256 usdcPriceUsd8 = usdcPriceWei / 1e10;

        return (wethPriceUsd8, usdcPriceUsd8);
    }

    function _printPosition(
        ILendingAdapter.Position memory position,
        ILendingAdapter.Eligibility memory eligibility,
        uint256 maxLiquidatableDebt,
        uint256 expectedCollateral,
        uint256 wethPriceUsd8,
        uint256 usdcPriceUsd8
    ) internal pure {
        _log("BORROWER:");
        _log(vm.toString(position.borrower));
        _log("");

        _log("HEALTH FACTOR:");
        _log(_formatHealthFactor(position.healthFactor));
        _log("");

        _log("COLLATERAL (WETH):");
        _log(_concat("  Amount: ", _formatWeth(position.collateralAmount), " WETH"));
        _log(_concat("  USD Value: $", _formatUsd(position.collateralUsd)));
        _log("");

        _log("DEBT (USDC):");
        _log(_concat("  Amount: ", _formatUsdc(position.debtAmount), " USDC"));
        _log(_concat("  USD Value: $", _formatUsd(position.debtUsd)));
        _log("");

        _log("LIQUIDATION PARAMETERS:");
        _log(_concat("  Liquidation Threshold: ", vm.toString(position.liquidationThreshold), " bps (", vm.toString(position.liquidationThreshold / 100), "%)"));
        _log(_concat("  Liquidation Bonus: ", vm.toString(position.liquidationBonus), " bps (", vm.toString(position.liquidationBonus / 100), "%)"));
        _log("  Close Factor: 5000 bps (50%)");
        _log("");

        _log("MAX LIQUIDATABLE DEBT:");
        _log(_concat("  ", _formatUsdc(maxLiquidatableDebt), " USDC"));
        _log("");

        _log("EXPECTED COLLATERAL (at max liquidation):");
        _log(_concat("  ", _formatWeth(expectedCollateral), " WETH"));
        _log(_concat("  USD Value: $", _formatUsd((expectedCollateral * wethPriceUsd8) / 1e18)));
        _log("");

        _log(_concat("LIQUIDATABLE: ", eligibility.eligible ? "YES" : "NO"));
        if (!eligibility.eligible) {
            _log(_concat("  Reason: ", eligibility.reason));
        }
        _log("");

        _log("==========================================");
        _log("SUMMARY FOR BACKSTOP:");
        _log("==========================================");
        _log(_concat("Borrower: ", vm.toString(position.borrower)));
        _log(_concat("Health Factor: ", _formatHealthFactor(position.healthFactor)));
        _log(_concat("Debt: ", _formatUsdc(position.debtAmount), " USDC ($", _formatUsd(position.debtUsd), ")"));
        _log(_concat("Collateral: ", _formatWeth(position.collateralAmount), " WETH ($", _formatUsd(position.collateralUsd), ")"));
        _log(_concat("Max Liquidation: ", _formatUsdc(maxLiquidatableDebt), " USDC"));
        _log(_concat("Liquidation Bonus: ", vm.toString(position.liquidationBonus / 100), "%"));
        _log(_concat("Expected Collateral: ~", _formatWeth(expectedCollateral), " WETH"));
        _log(_concat("Liquidatable: ", eligibility.eligible ? "YES" : "NO"));
        if (!eligibility.eligible) {
            _log(_concat("Blocked by: ", eligibility.reason));
        }
    }

    function _concat(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function _concat(string memory a, string memory b, string memory c) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b, c));
    }

    function _concat(string memory a, string memory b, string memory c, string memory d) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b, c, d));
    }

    function _concat(string memory a, string memory b, string memory c, string memory d, string memory e) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b, c, d, e));
    }

    function _log(string memory s) internal pure {
        console.log(s);
    }

    function _formatPrice(uint256 priceUsd8) internal pure returns (string memory) {
        uint256 whole = priceUsd8 / 1e8;
        uint256 frac = priceUsd8 % 1e8;
        return string(abi.encodePacked(vm.toString(whole), ".", _padLeft(frac, 8)));
    }

    function _formatHealthFactor(uint256 hf) internal pure returns (string memory) {
        if (hf == 0) return "0 (no debt)";
        if (hf >= 1e18) return string(abi.encodePacked(vm.toString(hf / 1e18), ".0 (healthy)"));
        uint256 whole = hf / 1e18;
        uint256 frac = hf % 1e18;
        return string(abi.encodePacked(vm.toString(whole), ".", _padLeft(frac, 18)));
    }

    function _formatWeth(uint256 amount) internal pure returns (string memory) {
        uint256 whole = amount / 1e18;
        uint256 frac = amount % 1e18;
        return string(abi.encodePacked(vm.toString(whole), ".", _padLeft(frac, 18)));
    }

    function _formatUsdc(uint256 amount) internal pure returns (string memory) {
        uint256 whole = amount / 1e6;
        uint256 frac = amount % 1e6;
        return string(abi.encodePacked(vm.toString(whole), ".", _padLeft(frac, 6)));
    }

    function _formatUsd(uint256 amountUsd) internal pure returns (string memory) {
        // amountUsd is in USD with 18 decimals from Aave
        uint256 whole = amountUsd / 1e18;
        uint256 frac = amountUsd % 1e18;
        return string(abi.encodePacked(vm.toString(whole), ".", _padLeft(frac, 18)));
    }

    function _padLeft(uint256 num, uint256 length) internal pure returns (string memory) {
        string memory s = vm.toString(num);
        if (bytes(s).length >= length) return s;
        string memory padded = new string(length - bytes(s).length);
        for (uint256 i = 0; i < length - bytes(s).length; i++) {
            bytes(padded)[i] = '0';
        }
        return string(abi.encodePacked(padded, s));
    }
}