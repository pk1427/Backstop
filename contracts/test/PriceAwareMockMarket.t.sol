// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MockPriceOracle} from "../src/mocks/MockPriceOracle.sol";
import {PriceAwareMockLendingPool} from "../src/mocks/PriceAwareMockLendingPool.sol";

contract TestWETH is ERC20 {
    constructor() ERC20("Mock WETH", "mWETH") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract TestUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract PriceAwareMockMarketTest is Test {
    TestWETH internal weth;
    TestUSDC internal usdc;
    MockPriceOracle internal oracle;
    PriceAwareMockLendingPool internal pool;
    address internal borrower = address(0xB0B);
    address internal liquidator = address(0x1A11CE);

    function setUp() public {
        weth = new TestWETH();
        usdc = new TestUSDC();
        oracle = new MockPriceOracle(address(this));
        pool = new PriceAwareMockLendingPool(weth, usdc, oracle, 6);
        oracle.setPrice(address(weth), 2_000e8);

        // 1 WETH collateral against 1,500 USDC debt starts at HF 1.1333.
        weth.mint(borrower, 1e18);
        usdc.mint(liquidator, 1_000e6);
        vm.prank(borrower);
        weth.approve(address(pool), type(uint256).max);
        vm.prank(liquidator);
        usdc.approve(address(pool), type(uint256).max);
        pool.fundBorrower(borrower, 1e18, 1_500e6);
    }

    function testOraclePriceMoveMakesExistingPositionLiquidatable() public {
        assertEq(pool.healthFactor(borrower), 1_133333333333333333);

        // Price falls 25%; the exact same collateral/debt position becomes liquidatable.
        oracle.setPrice(address(weth), 1_500e8);
        assertEq(pool.healthFactor(borrower), 850000000000000000);
    }

    function testLiquidationOnlyWorksAfterPriceMove() public {
        vm.prank(liquidator);
        vm.expectRevert("Position healthy");
        pool.liquidationCall(borrower, 500e6);

        oracle.setPrice(address(weth), 1_500e8);
        uint256 collateralBefore = weth.balanceOf(liquidator);
        vm.prank(liquidator);
        uint256 seized = pool.liquidationCall(borrower, 500e6);

        assertEq(seized, 350000000000000000);
        assertEq(weth.balanceOf(liquidator), collateralBefore + seized);
        assertEq(pool.borrowerDebt(borrower), 1_000e6);
        assertEq(pool.borrowerCollateral(borrower), 650000000000000000);
    }
}
