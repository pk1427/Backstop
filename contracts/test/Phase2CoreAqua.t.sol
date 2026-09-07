// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {dynamic} from "@aqua/test/utils/Dynamic.sol";
import {Aqua} from "@aqua/src/Aqua.sol";
import {IAqua} from "@aqua/src/interfaces/IAqua.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {LiquidationBackstopApp} from "../src/LiquidationBackstopApp.sol";
import {LiquidatorExecutor, MockLendingPool} from "../src/LiquidatorExecutor.sol";

contract Phase2CoreAquaTest is Test {
    LiquidationBackstopApp public backstopApp;
    LiquidatorExecutor public liquidatorExecutor;
    MockLendingPool public lendingPool;

    MockERC20 public usdc;
    MockERC20 public weth;

    Aqua public aqua;

    address public maker = address(0x1111);
    address public liquidator = address(0x3333);

    bytes32 public strategyHash;

    function setUp() public {
        aqua = new Aqua();
        backstopApp = new LiquidationBackstopApp(IAqua(address(aqua)));
        lendingPool = new MockLendingPool();
        liquidatorExecutor = new LiquidatorExecutor(IAqua(address(aqua)), lendingPool);

        usdc = new MockERC20("USDC", "USDC");
        weth = new MockERC20("WETH", "WETH");

        // Fund maker with USDC and WETH
        usdc.mint(maker, 10_000e18);
        weth.mint(maker, 10_000e18);

        // Fund liquidator with WETH
        weth.mint(address(liquidatorExecutor), 1_000e18);

        // Setup approvals for maker to Aqua
        vm.prank(maker);
        usdc.approve(address(aqua), type(uint256).max);
        vm.prank(maker);
        weth.approve(address(aqua), type(uint256).max);

        // Setup approvals for liquidatorExecutor to Aqua
        vm.prank(address(liquidatorExecutor));
        weth.approve(address(aqua), type(uint256).max);

        // Ship strategy directly via Aqua (maker calls AQUA.ship)
        LiquidationBackstopApp.Strategy memory strategy = LiquidationBackstopApp.Strategy({
            maker: maker,
            tokenIn: address(weth),
            tokenOut: address(usdc),
            maxTrade: 1_000e18,
            minDiscountBps: 100,
            maxDiscountBps: 500,
            expiry: uint64(block.timestamp + 365 days),
            salt: bytes32(0)
        });

        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(weth);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 5_000e18;
        amounts[1] = uint256(0);

        vm.prank(maker);
        strategyHash = aqua.ship(
            address(backstopApp),
            abi.encode(strategy),
            tokens,
            amounts
        );
    }

    // ========== HAPPY PATH: Full atomic swap ==========

    function testHappyPath_AtomicSwap() public {
        uint256 usdcPullAmount = 1_000e18;
        bytes32 quoteId = keccak256("quote-1");

        // Set a valid quote
        backstopApp.setQuote(quoteId, 200, usdcPullAmount, uint64(block.timestamp + 1 hours));

        // Setup under-collateralized borrower for liquidation
        address borrower = address(0x4444);
        uint256 collateralAmount = 2_000e18;
        uint256 debtAmount = 3_000e18;

        weth.mint(borrower, collateralAmount);
        usdc.mint(borrower, 5_000e18);

        vm.startPrank(borrower);
        weth.approve(address(lendingPool), collateralAmount);
        usdc.approve(address(lendingPool), 5_000e18);
        vm.stopPrank();

        lendingPool.fundBorrower(borrower, collateralAmount, debtAmount);

        // Verify position is under-collateralized
        uint256 hf = lendingPool.healthFactor(borrower);
        assertTrue(hf < 1e18, "Position should be under-collateralized");

        // Encode takerData: (borrower, expectedWethOut)
        bytes memory takerData = abi.encode(borrower, usdcPullAmount);

        // Execute swap
        vm.prank(address(liquidatorExecutor));
        uint256 pulled = backstopApp.swap(strategyHash, LiquidationBackstopApp.Strategy({
            maker: maker,
            tokenIn: address(weth),
            tokenOut: address(usdc),
            maxTrade: 1_000e18,
            minDiscountBps: 100,
            maxDiscountBps: 500,
            expiry: uint64(block.timestamp + 365 days),
            salt: bytes32(0)
        }), quoteId, takerData);

        // Verify USDC left maker
        assertEq(usdc.balanceOf(maker), 9_000e18);
        assertEq(pulled, usdcPullAmount);

        // Verify WETH arrived at maker (pushed via callback)
        assertEq(weth.balanceOf(maker), 10_000e18 + usdcPullAmount);

        // Verify Aqua balances
        (uint256 usdcBalance,) = aqua.rawBalances(maker, address(backstopApp), strategyHash, address(usdc));
        (uint256 wethBalance,) = aqua.rawBalances(maker, address(backstopApp), strategyHash, address(weth));
        assertEq(usdcBalance, 5_000e18 - usdcPullAmount);
        assertEq(wethBalance, usdcPullAmount);

        // Verify borrower position was updated
        assertEq(lendingPool.borrowerDebt(borrower), debtAmount - usdcPullAmount);
        assertEq(lendingPool.borrowerCollateral(borrower), collateralAmount - usdcPullAmount);
    }

    // ========== REJECTION: Expired quote ==========

    function testReject_ExpiredQuote() public {
        bytes32 quoteId = keccak256("quote-expired");

        // Set an expired quote
        backstopApp.setQuote(quoteId, 200, 1_000e18, uint64(block.timestamp - 1));

        bytes memory takerData = abi.encode(address(0x4444), 1_000e18);

        vm.prank(address(liquidatorExecutor));
        vm.expectRevert("Quote expired");
        backstopApp.swap(strategyHash, LiquidationBackstopApp.Strategy({
            maker: maker,
            tokenIn: address(weth),
            tokenOut: address(usdc),
            maxTrade: 1_000e18,
            minDiscountBps: 100,
            maxDiscountBps: 500,
            expiry: uint64(block.timestamp + 365 days),
            salt: bytes32(0)
        }), quoteId, takerData);
    }

    // ========== REJECTION: Quote size exceeds maxTrade ==========

    function testReject_QuoteSizeExceedsMaxTrade() public {
        bytes32 quoteId = keccak256("quote-too-large");

        // Set a quote larger than maxTrade (1_000e18)
        backstopApp.setQuote(quoteId, 200, 2_000e18, uint64(block.timestamp + 1 hours));

        bytes memory takerData = abi.encode(address(0x4444), 2_000e18);

        vm.prank(address(liquidatorExecutor));
        vm.expectRevert("Quote size exceeds maxTrade");
        backstopApp.swap(strategyHash, LiquidationBackstopApp.Strategy({
            maker: maker,
            tokenIn: address(weth),
            tokenOut: address(usdc),
            maxTrade: 1_000e18,
            minDiscountBps: 100,
            maxDiscountBps: 500,
            expiry: uint64(block.timestamp + 365 days),
            salt: bytes32(0)
        }), quoteId, takerData);
    }

    // ========== REJECTION: Quote price outside discount bounds ==========

    function testReject_QuotePriceBelowMinDiscount() public {
        bytes32 quoteId = keccak256("quote-below-min");

        // Set a quote with price below minDiscountBps (100)
        backstopApp.setQuote(quoteId, 50, 1_000e18, uint64(block.timestamp + 1 hours));

        bytes memory takerData = abi.encode(address(0x4444), 1_000e18);

        vm.prank(address(liquidatorExecutor));
        vm.expectRevert("Price below min discount");
        backstopApp.swap(strategyHash, LiquidationBackstopApp.Strategy({
            maker: maker,
            tokenIn: address(weth),
            tokenOut: address(usdc),
            maxTrade: 1_000e18,
            minDiscountBps: 100,
            maxDiscountBps: 500,
            expiry: uint64(block.timestamp + 365 days),
            salt: bytes32(0)
        }), quoteId, takerData);
    }

    function testReject_QuotePriceAboveMaxDiscount() public {
        bytes32 quoteId = keccak256("quote-above-max");

        // Set a quote with price above maxDiscountBps (500)
        backstopApp.setQuote(quoteId, 600, 1_000e18, uint64(block.timestamp + 1 hours));

        bytes memory takerData = abi.encode(address(0x4444), 1_000e18);

        vm.prank(address(liquidatorExecutor));
        vm.expectRevert("Price above max discount");
        backstopApp.swap(strategyHash, LiquidationBackstopApp.Strategy({
            maker: maker,
            tokenIn: address(weth),
            tokenOut: address(usdc),
            maxTrade: 1_000e18,
            minDiscountBps: 100,
            maxDiscountBps: 500,
            expiry: uint64(block.timestamp + 365 days),
            salt: bytes32(0)
        }), quoteId, takerData);
    }

    // ========== Helper: mock ERC20 ==========

    function testShipStrategy() public {
        LiquidationBackstopApp.Strategy memory strategy = LiquidationBackstopApp.Strategy({
            maker: maker,
            tokenIn: address(weth),
            tokenOut: address(usdc),
            maxTrade: 1_000e18,
            minDiscountBps: 100,
            maxDiscountBps: 500,
            expiry: uint64(block.timestamp + 365 days),
            salt: bytes32(uint256(0x1))
        });

        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(weth);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = uint256(0);
        amounts[1] = uint256(0);

        vm.prank(maker);
        bytes32 hash = aqua.ship(
            address(backstopApp),
            abi.encode(strategy),
            tokens,
            amounts
        );

        (uint256 usdcBal,) = aqua.rawBalances(maker, address(backstopApp), hash, address(usdc));
        (uint256 wethBal,) = aqua.rawBalances(maker, address(backstopApp), hash, address(weth));
        assertEq(usdcBal, 0);
        assertEq(wethBal, 0);
    }
}

// Mock ERC20 for testing
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
