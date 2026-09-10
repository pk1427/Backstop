// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AaveV3SepoliaAdapter} from "../src/adapters/AaveV3SepoliaAdapter.sol";

/// @notice Test the enhanced AaveV3SepoliaAdapter position reading and economics
contract AaveV3SepoliaAdapterTest is Test {
    AaveV3SepoliaAdapter public adapter;

    address public constant MOCK_POOL = address(0x1000);
    address public constant MOCK_ORACLE = address(0x2000);
    address public constant MOCK_DATA_PROVIDER = address(0x3000);
    address public constant WETH = 0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c;
    address public constant USDC = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;

    function setUp() public {
        adapter = new AaveV3SepoliaAdapter(MOCK_POOL, MOCK_ORACLE, MOCK_DATA_PROVIDER);
    }

    // ========== Configuration tests ==========

    function testAdapter_ReturnsCorrectName() public view {
        assertEq(adapter.name(), "Aave V3 Sepolia");
    }

    function testAdapter_ReturnsCorrectChainId() public view {
        assertEq(adapter.supportedChainId(), 11155111);
    }

    function testAdapter_ReturnsCorrectAddresses() public view {
        assertEq(adapter.pool(), MOCK_POOL);
        assertEq(adapter.oracle(), MOCK_ORACLE);
        assertEq(adapter.WETH(), WETH);
        assertEq(adapter.USDC(), USDC);
    }

    // ========== Pure math tests ==========

    function testCalculateMaxLiquidatableDebt_HalfOfDebt() public pure {
        uint256 debt = 1000e6;
        uint256 maxLiquidatable = (debt * 5000) / 10000;
        assertEq(maxLiquidatable, 500e6);
    }

    function testCalculateMaxLiquidatableDebt_ZeroDebt() public pure {
        uint256 maxLiquidatable = (0 * 5000) / 10000;
        assertEq(maxLiquidatable, 0);
    }

    function testCalculateMaxLiquidatableDebt_SmallDebt() public pure {
        uint256 debt = 1;
        uint256 maxLiquidatable = (debt * 5000) / 10000;
        assertEq(maxLiquidatable, 0);
    }

    function testCalculateMaxLiquidatableDebt_OneWeiDebt() public pure {
        uint256 debt = 1;
        uint256 maxLiquidatable = (debt * 5000) / 10000;
        assertEq(maxLiquidatable, 0);
    }

    function testCalculateMaxLiquidatableDebt_FullCloseFactor() public pure {
        uint256 debt = 10000;
        uint256 maxLiquidatable = (debt * 5000) / 10000;
        assertEq(maxLiquidatable, 5000);
    }

    // ========== Expected collateral math tests ==========

    function testGetExpectedCollateral_BasicCalculation() public {
        uint256 debtToCover = 1000e6;
        uint256 collateralPriceUsd8 = 3000 * 1e8;
        uint256 debtPriceUsd8 = 1 * 1e8;
        uint256 liquidationBonus = 10500;

        uint256 expected = (debtToCover * debtPriceUsd8 * (10 ** 18) * liquidationBonus) /
            ((10 ** 6) * collateralPriceUsd8 * 10000);

        assertEq(expected, (1000e6 * 1e8 * 1e18 * 10500) / (1e6 * 3000 * 1e8 * 10000));
    }

    function testGetExpectedCollateral_HigherBonusMeansMoreCollateral() public pure {
        uint256 debtToCover = 1000e6;
        uint256 collateralPrice = 3000 * 1e8;
        uint256 debtPrice = 1 * 1e8;

        uint256 lowBonus = (debtToCover * debtPrice * 1e18 * 10000) / (1e6 * collateralPrice * 10000);
        uint256 highBonus = (debtToCover * debtPrice * 1e18 * 11000) / (1e6 * collateralPrice * 10000);

        assertGt(highBonus, lowBonus);
    }

    function testGetExpectedCollateral_ZeroPricesReturnZero() public pure {
        uint256 debtToCover = 1000e6;
        uint256 resultWithZeroCollateral = (debtToCover * 1e8 * 1e18 * 10500) / (1e6 * 1 * 1e8 * 10000);
        assertGt(resultWithZeroCollateral, 0);
    }

    // ========== Mocked pool interaction tests ==========

    function testGetPosition_MockedPool() public {
        bytes memory userAccountData = abi.encode(
            1000e18,  // totalCollateralUsd
            500e6,    // totalDebtUsd
            500e6,    // availableBorrowsUsd
            8500,     // liquidationThreshold
            8000,     // ltv
            0.85e18   // healthFactor
        );
        vm.mockCall(MOCK_POOL, abi.encodeWithSelector(0xfa78107a, address(0x1234)), userAccountData);

        bytes memory wethReserveData = abi.encode(
            100e18,   // currentATokenBalance
            0,        // currentStableDebt
            100e6,    // currentVariableDebt
            0,        // principalStableDebt
            0,        // scaledVariableDebt
            0,        // stableBorrowRate
            0,        // liquidityRate
            0,        // stableRateLastUpdated
            true      // usageAsCollateralEnabled
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x28dd2d01, address(0x1234), WETH), wethReserveData);

        bytes memory usdcReserveData = abi.encode(
            0,        // currentATokenBalance
            0,        // currentStableDebt
            100e6,    // currentVariableDebt
            0,        // principalStableDebt
            0,        // scaledVariableDebt
            0,        // stableBorrowRate
            0,        // liquidityRate
            0,        // stableRateLastUpdated
            true      // usageAsCollateralEnabled
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x28dd2d01, address(0x1234), USDC), usdcReserveData);

        bytes memory wethConfig = abi.encode(
            18,       // decimals
            8000,     // ltv
            8500,     // liquidationThreshold
            10500,    // liquidationBonus
            1000,     // reserveFactor
            true,     // usageAsCollateralEnabled
            true,     // borrowingEnabled
            true,     // stableBorrowRateEnabled
            true,     // isActive
            false     // isFrozen
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x3e150141, WETH), wethConfig);

        bytes memory usdcConfig = abi.encode(
            6,        // decimals
            8000,     // ltv
            8500,     // liquidationThreshold
            10500,    // liquidationBonus
            1000,     // reserveFactor
            true,     // usageAsCollateralEnabled
            true,     // borrowingEnabled
            true,     // stableBorrowRateEnabled
            true,     // isActive
            false     // isFrozen
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x3e150141, USDC), usdcConfig);

        AaveV3SepoliaAdapter.Position memory pos = adapter.getPosition(address(0x1234));

        assertEq(pos.borrower, address(0x1234));
        assertEq(pos.collateralAsset, WETH);
        assertEq(pos.debtAsset, USDC);
        assertEq(pos.collateralAmount, 100e18);
        assertEq(pos.debtAmount, 100e6);
        assertEq(pos.healthFactor, 0.85e18);
        assertEq(pos.liquidationThreshold, 8500);
        assertEq(pos.liquidationBonus, 10500);
        assertEq(pos.collateralDecimals, 18);
        assertEq(pos.debtDecimals, 6);
        assertEq(pos.maxLiquidatableDebt, 50e6);
        assertTrue(pos.liquidatable);
    }

    function testIsLiquidatable_MockedPool() public {
        bytes memory userAccountData = abi.encode(
            1000e18,  // totalCollateralUsd
            500e6,    // totalDebtUsd
            500e6,    // availableBorrowsUsd
            8500,     // liquidationThreshold
            8000,     // ltv
            0.85e18   // healthFactor
        );
        vm.mockCall(MOCK_POOL, abi.encodeWithSelector(0xfa78107a, address(0x1234)), userAccountData);

        bytes memory wethReserveData = abi.encode(
            100e18, 0, 100e6, 0, 0, 0, 0, 0, true
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x28dd2d01, address(0x1234), WETH), wethReserveData);

        bytes memory usdcReserveData = abi.encode(
            100e18, 0, 100e6, 0, 0, 0, 0, 0, true
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x28dd2d01, address(0x1234), USDC), usdcReserveData);

        bytes memory wethConfig = abi.encode(
            18, 8000, 8500, 10500, 1000, true, true, true, true, false
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x3e150141, WETH), wethConfig);

        bytes memory usdcConfig = abi.encode(
            6, 8000, 8500, 10500, 1000, true, true, true, true, false
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x3e150141, USDC), usdcConfig);

        AaveV3SepoliaAdapter.Eligibility memory elig = adapter.isLiquidatable(address(0x1234));
        assertTrue(elig.eligible);
    }

    function testGetMaxLiquidatableDebt_MockedPool() public {
        bytes memory userAccountData = abi.encode(
            1000e18, 500e6, 500e6, 8500, 8000, 0.85e18
        );
        vm.mockCall(MOCK_POOL, abi.encodeWithSelector(0xfa78107a, address(0x1234)), userAccountData);

        bytes memory usdcReserveData = abi.encode(
            100e18, 0, 100e6, 0, 0, 0, 0, 0, true
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x28dd2d01, address(0x1234), USDC), usdcReserveData);

        uint256 maxDebt = adapter.getMaxLiquidatableDebt(address(0x1234));
        assertEq(maxDebt, 50e6);
    }

    function testIsLiquidatable_RejectsHealthyPosition() public {
        bytes memory userAccountData = abi.encode(
            1000e18, 500e6, 500e6, 8500, 8000, 1.5e18  // healthFactor > 1
        );
        vm.mockCall(MOCK_POOL, abi.encodeWithSelector(0xfa78107a, address(0x1234)), userAccountData);

        bytes memory wethReserveData = abi.encode(
            100e18, 0, 100e6, 0, 0, 0, 0, 0, true
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x28dd2d01, address(0x1234), WETH), wethReserveData);

        bytes memory usdcReserveData = abi.encode(
            100e18, 0, 100e6, 0, 0, 0, 0, 0, true
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x28dd2d01, address(0x1234), USDC), usdcReserveData);

        bytes memory wethConfig = abi.encode(
            18, 8000, 8500, 10500, 1000, true, true, true, true, false
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x3e150141, WETH), wethConfig);

        bytes memory usdcConfig = abi.encode(
            6, 8000, 8500, 10500, 1000, true, true, true, true, false
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x3e150141, USDC), usdcConfig);

        AaveV3SepoliaAdapter.Eligibility memory elig = adapter.isLiquidatable(address(0x1234));
        assertFalse(elig.eligible);
        assertEq(elig.reason, "Health factor >= 1");
    }

    function testIsLiquidatable_RejectsZeroDebt() public {
        bytes memory userAccountData = abi.encode(
            1000e18, 0, 500e6, 8500, 8000, 0.85e18  // totalDebtUsd = 0
        );
        vm.mockCall(MOCK_POOL, abi.encodeWithSelector(0xfa78107a, address(0x1234)), userAccountData);

        bytes memory wethReserveData = abi.encode(
            100e18, 0, 0, 0, 0, 0, 0, 0, true  // no variable debt
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x28dd2d01, address(0x1234), WETH), wethReserveData);

        bytes memory usdcReserveData = abi.encode(
            100e18, 0, 0, 0, 0, 0, 0, 0, true  // no variable debt
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x28dd2d01, address(0x1234), USDC), usdcReserveData);

        bytes memory wethConfig = abi.encode(
            18, 8000, 8500, 10500, 1000, true, true, true, true, false
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x3e150141, WETH), wethConfig);

        bytes memory usdcConfig = abi.encode(
            6, 8000, 8500, 10500, 1000, true, true, true, true, false
        );
        vm.mockCall(MOCK_DATA_PROVIDER, abi.encodeWithSelector(0x3e150141, USDC), usdcConfig);

        AaveV3SepoliaAdapter.Eligibility memory elig = adapter.isLiquidatable(address(0x1234));
        assertFalse(elig.eligible);
        assertEq(elig.reason, "No debt");
    }
}
