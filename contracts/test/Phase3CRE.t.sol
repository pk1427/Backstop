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
import {MockLendingPoolAdapter} from "../src/adapters/MockLendingPoolAdapter.sol";
import {QuoteRegistry, IReceiver} from "../src/QuoteRegistry.sol";

// Mock ERC20 for testing
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// Helper to get the InvalidSender error selector from ReceiverTemplate
bytes4 constant INVALID_SENDER_SELECTOR = bytes4(keccak256("InvalidSender(address,address)"));

contract Phase3CRETest is Test {
    LiquidationBackstopApp public backstopApp;
    LiquidatorExecutor public liquidatorExecutor;
    MockLendingPool public lendingPool;
    QuoteRegistry public quoteRegistry;

    MockERC20 public usdc;
    MockERC20 public weth;

    Aqua public aqua;

    address public maker = address(0x1111);
    address public liquidator = address(0x3333);
    address public forwarder = address(0xABCD);
    address public randomCaller = address(0x9999);

    bytes32 public strategyHash;

    function setUp() public {
        aqua = new Aqua();
        quoteRegistry = new QuoteRegistry(forwarder);
        backstopApp = new LiquidationBackstopApp(IAqua(address(aqua)), quoteRegistry);
        lendingPool = new MockLendingPool();
        MockLendingPoolAdapter adapter = new MockLendingPoolAdapter(lendingPool);
        liquidatorExecutor = new LiquidatorExecutor(IAqua(address(aqua)), adapter);

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

    // ========== QUOTE REGISTRY: Authorized forwarder can submit ==========

    function testQuoteRegistry_AuthorizedForwarderCanSubmit() public {
        bytes32 quoteId = keccak256("quote-auth");
        uint256 price = 200;
        uint256 size = 1_000e18;
        uint64 expiry = uint64(block.timestamp + 1 hours);

        // Encode quote payload
        bytes memory payload = abi.encode(quoteId, price, size, expiry, true);

        // Forwarder calls onReport
        vm.prank(forwarder);
        quoteRegistry.onReport("", payload);

        // Verify quote stored
        QuoteRegistry.Quote memory q = quoteRegistry.getQuote(quoteId);
        assertEq(q.quoteId, quoteId);
        assertEq(q.price, price);
        assertEq(q.size, size);
        assertEq(q.expiry, expiry);
        assertTrue(q.execute);
        assertTrue(quoteRegistry.hasQuote(quoteId));
    }

    // ========== QUOTE REGISTRY: Unauthorized cannot submit ==========

    function testQuoteRegistry_UnauthorizedCannotSubmit() public {
        bytes32 quoteId = keccak256("quote-unauth");
        bytes memory payload = abi.encode(quoteId, 200, 1_000e18, uint64(block.timestamp + 1 hours), true);

        vm.prank(randomCaller);
        vm.expectRevert(abi.encodeWithSelector(INVALID_SENDER_SELECTOR, randomCaller, forwarder));
        quoteRegistry.onReport("", payload);
    }

    // ========== QUOTE REGISTRY: Decodes quote correctly ==========

    function testQuoteRegistry_DecodesQuoteCorrectly() public {
        bytes32 quoteId = keccak256("quote-decode");
        uint256 price = 350;
        uint256 size = 500e18;
        uint64 expiry = uint64(block.timestamp + 30 minutes);

        bytes memory payload = abi.encode(quoteId, price, size, expiry, true);

        vm.prank(forwarder);
        quoteRegistry.onReport("", payload);

        QuoteRegistry.Quote memory q = quoteRegistry.getQuote(quoteId);
        assertEq(q.price, 350);
        assertEq(q.size, 500e18);
        assertEq(q.expiry, expiry);
        assertTrue(q.execute);
    }

    // ========== PRODUCTION QUOTE: Consumed by backstop app ==========

    function testProductionQuote_ConsumedByBackstopApp() public {
        bytes32 quoteId = keccak256("quote-prod");
        uint256 price = 200;
        uint256 size = 1_000e18;
        uint64 expiry = uint64(block.timestamp + 1 hours);

        // Submit quote via forwarder
        bytes memory payload = abi.encode(quoteId, price, size, expiry, true);
        vm.prank(forwarder);
        quoteRegistry.onReport("", payload);

        // Setup under-collateralized borrower
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

        // Execute swap using registry quote
        bytes memory takerData = abi.encode(borrower, size);
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

        assertEq(pulled, size);
        assertEq(usdc.balanceOf(maker), 10_000e18 - size);
        assertEq(weth.balanceOf(maker), 10_000e18 + size);
    }

    // ========== REJECTION: Expired quote ==========

    function testProductionQuote_ExpiredRejected() public {
        bytes32 quoteId = keccak256("quote-expired-prod");
        bytes memory payload = abi.encode(quoteId, 200, 1_000e18, uint64(block.timestamp - 1), true);

        vm.prank(forwarder);
        quoteRegistry.onReport("", payload);

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

    // ========== REJECTION: Size above maxTrade ==========

    function testProductionQuote_SizeAboveMaxTradeRejected() public {
        bytes32 quoteId = keccak256("quote-too-large-prod");
        bytes memory payload = abi.encode(quoteId, 200, 2_000e18, uint64(block.timestamp + 1 hours), true);

        vm.prank(forwarder);
        quoteRegistry.onReport("", payload);

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

    // ========== REJECTION: Price outside bounds ==========

    function testProductionQuote_PriceOutsideBoundsRejected() public {
        // Below min
        bytes32 quoteIdLow = keccak256("quote-below-min-prod");
        bytes memory payloadLow = abi.encode(quoteIdLow, 50, 1_000e18, uint64(block.timestamp + 1 hours), true);
        vm.prank(forwarder);
        quoteRegistry.onReport("", payloadLow);

        bytes memory takerDataLow = abi.encode(address(0x4444), 1_000e18);
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
        }), quoteIdLow, takerDataLow);

        // Above max
        bytes32 quoteIdHigh = keccak256("quote-above-max-prod");
        bytes memory payloadHigh = abi.encode(quoteIdHigh, 600, 1_000e18, uint64(block.timestamp + 1 hours), true);
        vm.prank(forwarder);
        quoteRegistry.onReport("", payloadHigh);

        bytes memory takerDataHigh = abi.encode(address(0x4444), 1_000e18);
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
        }), quoteIdHigh, takerDataHigh);
    }
}
