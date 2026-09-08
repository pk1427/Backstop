# 1inch — Build an Aqua App Feedback

## What we built

A custom AquaApp (`LiquidationBackstopApp`) that enforces immutable strategy bounds and executes an atomic `pull()` → callback → `push()` settlement for confidential liquidation backstops.

## Sponsor requirement checklist

| Requirement | Evidence |
|-------------|----------|
| Official Aqua/SwapVM contracts used | Submodule at `contracts/lib/aqua`; remapped as `@aqua/` in `foundry.toml` |
| Real onchain token transfer at demo | `LiquidatorExecutor.backstopCallback()` pulls USDC from maker, calls mock `liquidationCall()`, pushes WETH back — verified in `Phase2CoreAqua.t.sol:88-147` and `Phase5FullIntegration.t.sol:41-61` |
| Continuous Git history from Day 1 | 6+ commits since Day 1: `384ddf8`, `b40a3b4`, `6a1d4dc`, `c4b7ff2`, `992ac82`, `177e2a0`, `509fe6a`, `4979252`, `900a8f6`, `7f8315a` |

## Key files

| File | Purpose |
|------|---------|
| `contracts/src/LiquidationBackstopApp.sol` | Custom AquaApp with `swap()` entrypoint, quote validation, `AQUA.pull()` + callback + `_safeCheckAquaPush()` |
| `contracts/src/LiquidatorExecutor.sol` | Implements `IBackstopTaker`; receives pulled USDC, calls `liquidationCall()`, pushes WETH via `aqua.push()` |
| `contracts/test/Phase2CoreAqua.t.sol` | Happy-path atomic swap (`testHappyPath_AtomicSwap`), rejection cases |
| `contracts/test/Phase5FullIntegration.t.sol` | Full pipeline: mock CRE → `QuoteRegistry` → Aqua pull → liquidation → WETH push |
| `foundry.toml` | Remappings for `@aqua/`, `@swap-vm/`, `@1inch/solidity-utils/`, `@openzeppelin/contracts/` |
| `contracts/script/DeployBackstopApp.s.sol` | Deployment script for `LiquidationBackstopApp` |

## Architecture notes

- **Immutable strategy bounds** live in the `Strategy` struct (`contracts/src/LiquidationBackstopApp.sol:23-32`): `maker`, `tokenIn`, `tokenOut`, `maxTrade`, `minDiscountBps`, `maxDiscountBps`, `expiry`, `salt`.
- **Output leg** (USDC) is pulled from maker via `aqua.pull()` (`LiquidationBackstopApp.sol:74`).
- **Input leg** (WETH) is pushed back to maker via `aqua.push()` (`LiquidatorExecutor.sol:45`).
- The taker callback (`LiquidatorExecutor.backstopCallback`, `LiquidatorExecutor.sol:25-48`) is where the liquidation happens mid-settlement.

## Demo

Run `forge test --match-test testHappyPath_AtomicSwap --via-ir -vvv` to see the atomic swap on a fork. The test at `Phase2CoreAqua.t.sol:88` verifies:
- USDC balance decreases by `usdcPullAmount`
- WETH balance increases by `usdcPullAmount`
- Aqua internal balances updated correctly
- Borrower debt/collateral reduced
