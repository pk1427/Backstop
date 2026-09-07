// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, stdError} from "forge-std/Test.sol";
import {dynamic} from "@aqua/test/utils/Dynamic.sol";
import {Aqua} from "@aqua/src/Aqua.sol";
import {AquaApp} from "@aqua/src/AquaApp.sol";
import {IAqua} from "@aqua/src/interfaces/IAqua.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Spike C/D: Minimal backstop app.
// Maker ships USDC (output leg). Taker pulls USDC, then pushes WETH (input leg) back to maker.
contract BackstopApp is AquaApp {
    error CallbackFailed(address token, uint256 newBalance, uint256 expectedBalance);

    event SwapExecuted(bytes32 indexed strategyHash, address indexed maker, uint256 usdcPulled, uint256 wethPushed);

    struct Strategy {
        address maker;
        address tokenIn;   // WETH (maker's input/push leg)
        address tokenOut;  // USDC (maker's output/pull leg)
        uint256 maxTrade;
        uint16  minDiscountBps;
        uint16  maxDiscountBps;
        uint64  expiry;
        bytes32 salt;
    }

    constructor(IAqua aqua_) AquaApp(aqua_) {}

    // takerData is empty for Spike C, contains liquidation params for Spike D
    function swap(bytes32 strategyHash, Strategy calldata strategy, uint256 amountOut, address to, bytes calldata takerData) external nonReentrantStrategy(strategy.maker, strategyHash) returns (uint256) {
        // Pull USDC from maker to taker
        AQUA.pull(strategy.maker, strategyHash, strategy.tokenOut, amountOut, to);

        // Call taker callback - taker must push WETH back
        IBackstopTaker(msg.sender).backstopCallback(strategy.tokenIn, strategy.tokenOut, amountOut, strategy.maker, address(this), strategyHash, takerData);

        // Verify taker pushed enough WETH
        _safeCheckAquaPush(strategy.maker, strategyHash, strategy.tokenIn, amountOut);

        emit SwapExecuted(strategyHash, strategy.maker, amountOut, amountOut);
        return amountOut;
    }
}

// Spike C/D: Taker callback interface
interface IBackstopTaker {
    function backstopCallback(address tokenIn, address tokenOut, uint256 amountOut, address maker, address app, bytes32 strategyHash, bytes calldata takerData) external;
}

// Spike C: Taker that simply pushes WETH back to maker.
contract SimpleTaker is IBackstopTaker {
    event PushExecuted(address indexed maker, address token, uint256 amount);

    IAqua public immutable aqua;

    constructor(IAqua aqua_) {
        aqua = aqua_;
    }

    function backstopCallback(address tokenIn, address /* tokenOut */, uint256 amountOut, address maker, address app, bytes32 strategyHash, bytes calldata) external override {
        uint256 wethToPush = amountOut; // 1:1 for spike C
        IERC20(tokenIn).approve(address(aqua), wethToPush);
        aqua.push(maker, app, strategyHash, tokenIn, wethToPush);
        emit PushExecuted(maker, tokenIn, wethToPush);
    }
}

// Spike D: Taker that first calls mock Aave liquidation, then pushes resulting WETH to maker.
contract LiquidatorTaker is IBackstopTaker {
    event LiquidationCalled(address indexed pool, address indexed borrower, uint256 debtRepaid, uint256 collateralSeized);
    event PushExecuted(address indexed maker, address token, uint256 amount);

    IAqua public immutable aqua;
    MockLendingPool public immutable pool;

    constructor(IAqua aqua_, MockLendingPool pool_) {
        aqua = aqua_;
        pool = pool_;
    }

    function backstopCallback(address tokenIn, address /* tokenOut */, uint256 amountOut, address maker, address app, bytes32 strategyHash, bytes calldata takerData) external override {
        // Decode liquidation params from takerData
        (address borrower, uint256 expectedWethOut) = abi.decode(takerData, (address, uint256));

        // Call mock Aave liquidation using the pulled USDC (already in this contract via pull)
        uint256 wethReceived = pool.liquidationCall(borrower, amountOut);

        emit LiquidationCalled(address(pool), borrower, amountOut, wethReceived);

        // Push the resulting WETH back to maker
        require(wethReceived >= expectedWethOut, "Insufficient WETH from liquidation");
        IERC20(tokenIn).approve(address(aqua), wethReceived);
        aqua.push(maker, app, strategyHash, tokenIn, wethReceived);
        emit PushExecuted(maker, tokenIn, wethReceived);
    }
}

// Spike D: Minimal Aave-fork-compatible lending pool mock.
contract MockLendingPool {
    event Liquidation(address indexed borrower, uint256 debtRepaid, uint256 collateralSeized);

    mapping(address => uint256) public borrowerCollateral;
    mapping(address => uint256) public borrowerDebt;

    function fundBorrower(address borrower, uint256 collateral, uint256 debt) external {
        borrowerCollateral[borrower] = collateral;
        borrowerDebt[borrower] = debt;
    }

    // liquidationCall(borrower, debtToRepay) -> returns collateral seized (WETH)
    function liquidationCall(address borrower, uint256 debtToRepay) external returns (uint256) {
        require(borrowerDebt[borrower] >= debtToRepay, "Debt too small");
        uint256 collateralToSeize = debtToRepay; // 1:1 for simplicity
        require(borrowerCollateral[borrower] >= collateralToSeize, "Insufficient collateral");

        borrowerDebt[borrower] -= debtToRepay;
        borrowerCollateral[borrower] -= collateralToSeize;

        emit Liquidation(borrower, debtToRepay, collateralToSeize);
        return collateralToSeize;
    }

    function healthFactor(address borrower) external view returns (uint256) {
        if (borrowerDebt[borrower] == 0) return type(uint256).max;
        return (borrowerCollateral[borrower] * 1e18) / borrowerDebt[borrower];
    }
}

// Mock ERC20 for testing
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract Phase1SpikesTest is Test {
    Aqua public aqua;
    BackstopApp public backstopApp;
    MockERC20 public usdc;
    MockERC20 public weth;
    MockLendingPool public lendingPool;

    address public maker = address(0x1111);
    address public taker = address(0x2222);

    SimpleTaker public simpleTaker;
    LiquidatorTaker public liquidatorTaker;

    bytes32 public strategyHash;

    function setUp() public {
        aqua = new Aqua();
        backstopApp = new BackstopApp(aqua);
        usdc = new MockERC20("USDC", "USDC");
        weth = new MockERC20("WETH", "WETH");
        lendingPool = new MockLendingPool();

        simpleTaker = new SimpleTaker(aqua);
        liquidatorTaker = new LiquidatorTaker(aqua, lendingPool);

        // Fund maker with USDC and WETH
        usdc.mint(maker, 10_000e18);
        weth.mint(maker, 10_000e18);
        // Fund taker (EOA) with some WETH for pushes via simpleTaker
        weth.mint(taker, 1_000e18);
        // Fund simpleTaker contract with WETH
        weth.mint(address(simpleTaker), 1_000e18);
        // Fund liquidator contract with WETH
        weth.mint(address(liquidatorTaker), 1_000e18);

        // Setup approvals for maker to Aqua
        vm.prank(maker);
        usdc.approve(address(aqua), type(uint256).max);
        vm.prank(maker);
        weth.approve(address(aqua), type(uint256).max);

        // Setup approvals for simpleTaker to Aqua
        vm.prank(address(simpleTaker));
        weth.approve(address(aqua), type(uint256).max);

        // Setup approvals for liquidator contract to Aqua
        vm.prank(address(liquidatorTaker));
        weth.approve(address(aqua), type(uint256).max);

        // Ship strategy: maker gives USDC, expects WETH back
        bytes memory strategy = abi.encode(
            BackstopApp.Strategy({
                maker: maker,
                tokenIn: address(weth),
                tokenOut: address(usdc),
                maxTrade: 1_000e18,
                minDiscountBps: 100,
                maxDiscountBps: 500,
                expiry: uint64(block.timestamp + 365 days),
                salt: bytes32(0)
            })
        );

        address[2] memory tokens = [address(usdc), address(weth)];
        uint256[2] memory amounts = [5_000e18, uint256(0)];

        vm.prank(maker);
        strategyHash = aqua.ship(
            address(backstopApp),
            strategy,
            dynamic(tokens),
            dynamic(amounts)
        );
    }

    // ========== SPIKE C: ship/pull/push atomic swap ==========

    function testSpikeC_ShipPullPushAtomic() public {
        uint256 usdcPullAmount = 1_000e18;

        // Verify initial state
        assertEq(usdc.balanceOf(maker), 10_000e18);
        assertEq(weth.balanceOf(maker), 10_000e18);
        assertEq(weth.balanceOf(address(simpleTaker)), 1_000e18);

        // Taker (simpleTaker contract) calls swap on backstop app
        vm.prank(address(simpleTaker));
        backstopApp.swap(strategyHash, BackstopApp.Strategy({
            maker: maker,
            tokenIn: address(weth),
            tokenOut: address(usdc),
            maxTrade: 1_000e18,
            minDiscountBps: 100,
            maxDiscountBps: 500,
            expiry: uint64(block.timestamp + 365 days),
            salt: bytes32(0)
        }), usdcPullAmount, address(simpleTaker), "");

        // Verify USDC left maker and went to simpleTaker
        assertEq(usdc.balanceOf(maker), 9_000e18);
        assertEq(usdc.balanceOf(address(simpleTaker)), usdcPullAmount);

        // Verify WETH arrived at maker (pushed via callback)
        assertEq(weth.balanceOf(maker), 10_000e18 + usdcPullAmount);
        assertEq(weth.balanceOf(address(simpleTaker)), 1_000e18 - usdcPullAmount);

        // Verify Aqua balances
        (uint256 usdcBalance,) = aqua.rawBalances(maker, address(backstopApp), strategyHash, address(usdc));
        (uint256 wethBalance,) = aqua.rawBalances(maker, address(backstopApp), strategyHash, address(weth));
        assertEq(usdcBalance, 5_000e18 - usdcPullAmount);
        assertEq(wethBalance, usdcPullAmount);
    }

    // ========== SPIKE D: liquidation callback composition ==========

    function testSpikeD_LiquidationCallbackInSameTransaction() public {
        // Setup: create an under-collateralized borrower position
        address borrower = address(0x4444);
        uint256 collateralAmount = 2_000e18;
        uint256 debtAmount = 3_000e18;

        weth.mint(borrower, collateralAmount);
        usdc.mint(borrower, 5_000e18); // for repaying

        vm.startPrank(borrower);
        weth.approve(address(lendingPool), collateralAmount);
        usdc.approve(address(lendingPool), 5_000e18);
        vm.stopPrank();

        lendingPool.fundBorrower(borrower, collateralAmount, debtAmount);

        // Verify position is under-collateralized
        uint256 hf = lendingPool.healthFactor(borrower);
        assertTrue(hf < 1e18, "Position should be under-collateralized");

        uint256 usdcToRepay = 1_000e18;
        uint256 expectedWethSeized = usdcToRepay;

        // Verify liquidator contract has WETH initially
        assertEq(weth.balanceOf(address(liquidatorTaker)), 1_000e18);

        // Execute liquidation callback flow via backstop app
        // takerData encodes: (borrower, expectedWethOut)
        bytes memory takerData = abi.encode(borrower, expectedWethSeized);

        // The liquidatorTaker contract calls swap, which triggers its own callback
        vm.prank(address(liquidatorTaker));
        backstopApp.swap(strategyHash, BackstopApp.Strategy({
            maker: maker,
            tokenIn: address(weth),
            tokenOut: address(usdc),
            maxTrade: 1_000e18,
            minDiscountBps: 100,
            maxDiscountBps: 500,
            expiry: uint64(block.timestamp + 365 days),
            salt: bytes32(0)
        }), usdcToRepay, address(liquidatorTaker), takerData);

        // Verify WETH was seized from borrower and pushed to maker
        assertEq(weth.balanceOf(maker), 10_000e18 + expectedWethSeized);

        // Verify Aqua WETH balance increased (pushed to maker)
        (uint256 wethBalance,) = aqua.rawBalances(maker, address(backstopApp), strategyHash, address(weth));
        assertEq(wethBalance, expectedWethSeized);

        // Verify borrower position was updated
        assertEq(lendingPool.borrowerDebt(borrower), debtAmount - usdcToRepay);
        assertEq(lendingPool.borrowerCollateral(borrower), collateralAmount - expectedWethSeized);
    }

    // ========== Helper: mock ERC20 ==========

    function testShipWithZeroAmounts() public {
        bytes memory strategy = abi.encode(
            BackstopApp.Strategy({
                maker: maker,
                tokenIn: address(weth),
                tokenOut: address(usdc),
                maxTrade: 1_000e18,
                minDiscountBps: 100,
                maxDiscountBps: 500,
                expiry: uint64(block.timestamp + 365 days),
                salt: bytes32(uint256(0x1))
            })
        );

        address[2] memory zeroTokens = [address(usdc), address(weth)];
        uint256[2] memory zeroAmounts = [uint256(0), uint256(0)];

        vm.prank(maker);
        bytes32 hash = aqua.ship(
            address(backstopApp),
            strategy,
            dynamic(zeroTokens),
            dynamic(zeroAmounts)
        );

        (uint256 usdcBal,) = aqua.rawBalances(maker, address(backstopApp), hash, address(usdc));
        (uint256 wethBal,) = aqua.rawBalances(maker, address(backstopApp), hash, address(weth));
        assertEq(usdcBal, 0);
        assertEq(wethBal, 0);
    }
}
