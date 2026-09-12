// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Aqua} from "@aqua/src/Aqua.sol";
import {IAqua} from "@aqua/src/interfaces/IAqua.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LiquidationBackstopApp} from "../src/LiquidationBackstopApp.sol";
import {LiquidatorExecutor} from "../src/LiquidatorExecutor.sol";
import {QuoteRegistry} from "../src/QuoteRegistry.sol";
import {MockPriceOracle} from "../src/mocks/MockPriceOracle.sol";
import {PriceAwareMockLendingPool} from "../src/mocks/PriceAwareMockLendingPool.sol";
import {PriceAwareMockLendingPoolAdapter} from "../src/adapters/PriceAwareMockLendingPoolAdapter.sol";

contract MarketWETH is ERC20 {
    constructor() ERC20("Market WETH", "mWETH") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
contract MarketUSDC is ERC20 {
    constructor() ERC20("Market USDC", "mUSDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @notice Complete controlled-market lifecycle: healthy -> price shock -> CRE quote -> Aqua settlement.
contract PriceAwareAtomicSettlementTest is Test {
    Aqua internal aqua;
    MarketWETH internal weth;
    MarketUSDC internal usdc;
    MockPriceOracle internal oracle;
    PriceAwareMockLendingPool internal pool;
    QuoteRegistry internal registry;
    LiquidationBackstopApp internal app;
    LiquidatorExecutor internal executor;
    address internal maker = address(0x1111);
    address internal borrower = address(0xB0B);
    address internal liquidator = address(0x3333);
    address internal forwarder = address(0xABCD);
    bytes32 internal strategyHash;

    function setUp() public {
        aqua = new Aqua();
        weth = new MarketWETH(); usdc = new MarketUSDC();
        oracle = new MockPriceOracle(address(this));
        oracle.setPrice(address(weth), 2_000e8);
        pool = new PriceAwareMockLendingPool(weth, usdc, oracle, 6);
        registry = new QuoteRegistry(forwarder);
        app = new LiquidationBackstopApp(IAqua(address(aqua)), registry);
        PriceAwareMockLendingPoolAdapter adapter = new PriceAwareMockLendingPoolAdapter(pool, address(usdc), address(weth), oracle);
        executor = new LiquidatorExecutor(IAqua(address(aqua)), adapter, address(app));
        app.setExecutor(address(executor)); registry.setBackstopApp(address(app));

        usdc.mint(maker, 1_000e6); weth.mint(borrower, 1e18);
        vm.prank(maker); usdc.approve(address(aqua), type(uint256).max);
        vm.prank(borrower); weth.approve(address(pool), type(uint256).max);
        pool.fundBorrower(borrower, 1e18, 1_500e6);

        LiquidationBackstopApp.Strategy memory strategy = _strategy();
        address[] memory tokens = new address[](2); tokens[0] = address(usdc); tokens[1] = address(weth);
        uint256[] memory amounts = new uint256[](2); amounts[0] = 500e6;
        vm.prank(maker); strategyHash = aqua.ship(address(app), abi.encode(strategy), tokens, amounts);
    }

    function testHealthyPositionBecomesLiquidatableThenSettlesAtomically() public {
        assertEq(pool.healthFactor(borrower), 1_133333333333333333);
        oracle.setPrice(address(weth), 1_500e8);
        assertEq(pool.healthFactor(borrower), 850000000000000000);

        bytes32 quoteId = keccak256("price-shock-cre-quote");
        vm.prank(forwarder);
        registry.onReport("", abi.encode(quoteId, 200, 500e6, 350000000000000000, uint64(block.timestamp + 1 hours), true));

        uint256 makerUsdcBefore = usdc.balanceOf(maker);
        uint256 makerWethBefore = weth.balanceOf(maker);
        vm.prank(liquidator);
        executor.execute(strategyHash, _strategy(), quoteId, borrower, 350000000000000000);

        assertEq(usdc.balanceOf(maker), makerUsdcBefore - 500e6);
        assertEq(weth.balanceOf(maker), makerWethBefore + 350000000000000000);
        assertEq(pool.borrowerDebt(borrower), 1_000e6);
        assertTrue(registry.quoteConsumed(quoteId));
    }

    function _strategy() internal view returns (LiquidationBackstopApp.Strategy memory) {
        return LiquidationBackstopApp.Strategy(maker, address(weth), address(usdc), 500e6, 100, 500, uint64(block.timestamp + 1 days), bytes32(0));
    }
}
