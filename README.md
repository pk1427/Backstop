# Confidential Liquidation Backstop

A self-custodial, privately-priced, policy-bounded, programmable liquidation-liquidity position built for ETHGlobal 2026.

## Architecture

```
PRIVY (policy-scoped embedded wallet)
   │  ship() — USDC virtual balance, immutable hard bounds
   ▼
AQUA STRATEGY (immutable once shipped)
   │  pair: USDC/WETH · maxTrade · minDiscount/maxDiscount · expiry · maker · salt
   │
AAVE V3 SEPOLIA (real lending pool)
   │  pool: 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951
   │  oracle: 0x2da88497588bf89281816106C7259e31AF45a663
   │  USDC: 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8
   │  WETH: 0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c
   ▼
AaveV3SepoliaAdapter (ILendingAdapter; integration code, not end-to-end proven)
   │  getPosition() → Aave account data and reserve configuration via eth_call
   │  isLiquidatable() → eligibility check (health factor, reserve state, close factor)
   │  getExpectedCollateral() → Aave liquidation-b bonus math
   │  liquidationCall() → Aave V3 call model (requires a verified liquidatable position)
   ▼
CHAINLINK CRE — Confidential Workflow (handlerInTee)
   │  private: maker's discount curve, risk thresholds, sizing preference
   │  public:  health factor, collateral price, requested size
   │  authenticated onchain delivery via CRE forwarder
   ▼
QuoteRegistry[quoteId] = {price, size, expiry}   ← only the CRE forwarder may write
   │
LiquidationBackstopApp.swap()  (custom AquaApp)
   │  validates quote against the IMMUTABLE strategy bounds
   │  (price within min/max discount, size ≤ maxTrade, not expired, correct assets)
   │
   ├─ aqua.pull(maker, strategyHash, USDC, size, LiquidatorExecutor)   ← maker's OUTPUT leg
   ▼
LiquidatorExecutor.aquaAppSwapCallback()
   │  spends the pulled USDC to call AaveV3SepoliaAdapter.liquidationCall()
   │  receives WETH collateral in return
   │
    └─ aqua.push(maker, app, strategyHash, WETH, amountReceived)       ← maker's INPUT leg
    ▼
ATOMIC SETTLEMENT COMPLETE
Maker's wallet now holds WETH it didn't have before; USDC it approved is gone;
everything happens in one transaction in the mock/fork tests. It is not a
claim of a completed live Sepolia liquidation or CRE delivery.
```

### Quote units

`price` is a discount in basis points; `size` is the debt amount in the debt
asset's raw units (USDC uses 6 decimals); and `minCollateralOut` is the minimum
collateral delivery in the collateral asset's raw units (WETH uses 18 decimals).
Settlement compares only `actualCollateralReceived >= minCollateralOut`. The
simulated CRE workflow supplies this field; a future live workflow must derive it
from authenticated prices, discount, and token decimals.

The exact quote formula is `floor(debtAmount * debtPriceUsd8 * 10^collateralDecimals
* 10_000 / (10^debtDecimals * collateralPriceUsd8 * (10_000 - discountBps)))`.
Prices are USD-per-whole-token with 8 decimals. Aave's liquidation bonus is used
as a separate feasibility check: it must produce at least this maker minimum; it
does not lower the minimum promised to the maker.

## Quick Start

### Prerequisites

- [Foundry](https://getfoundry.sh/)
- [Node.js](https://nodejs.org/) + npm
- [Privy](https://privy.io/) account + App ID
- Chainlink CRE CLI + enrollment in Confidential Workflows private beta

### 1. Clone and install

```bash
git clone https://github.com/pk1427/Backstop.git
cd Backstop
git submodule update --init --recursive
forge install
cd frontend && npm install && cd ..
```

### 2. Configure environment

```bash
cp frontend/.env.example frontend/.env.local
```

Required variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Your Privy App ID |
| `NEXT_PUBLIC_PRIVY_AUTH_KEY_ID` | Privy auth key ID for scoped signer |
| `NEXT_PUBLIC_PRIVY_POLICY_ID` | Privy policy ID |
| `NEXT_PUBLIC_BACKSTOP_APP_ADDRESS` | Deployed `LiquidationBackstopApp` address |
| `NEXT_PUBLIC_QUOTE_REGISTRY_ADDRESS` | Deployed `QuoteRegistry` address |
| `NEXT_PUBLIC_AQUA_REGISTRY_ADDRESS` | Aqua registry address (Sepolia: `0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a`) |
| `NEXT_PUBLIC_USDC_ADDRESS` | USDC token address on target chain |
| `NEXT_PUBLIC_WETH_ADDRESS` | WETH token address on target chain |
| `NEXT_PUBLIC_RPC_URL` | Sepolia RPC URL |
| `NEXT_PUBLIC_CHAIN_ID` | Chain ID (default: `11155111`) |
| `NEXT_PUBLIC_ALLOWED_ADDRESS` | Optional extra address for client-side allowlist |
| `NEXT_PUBLIC_AAVE_POOL_ADDRESS` | Aave V3 Pool address (Sepolia) |
| `NEXT_PUBLIC_AAVE_ORACLE` | Aave V3 Oracle address (Sepolia) |
| `NEXT_PUBLIC_AAVE_USDC_ADDRESS` | Aave USDC address (Sepolia) |
| `NEXT_PUBLIC_AAVE_WETH_ADDRESS` | Aave WETH address (Sepolia) |

### 3. Run tests

```bash
cd contracts
forge test --via-ir
```

### 4. Run frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:3000 and login with Privy.

> **Note:** The frontend requires valid Privy credentials (`NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_PRIVY_AUTH_KEY_ID`, `NEXT_PUBLIC_PRIVY_POLICY_ID`) to build and run. Without them, the Privy provider will fail to initialize. The `.env.local` file is gitignored; copy `.env.example` and fill in your own values from the [Privy Dashboard](https://dashboard.privy.io/).

## Project Structure

```
contracts/
├── src/
│   ├── LiquidationBackstopApp.sol   # Custom AquaApp — quote validation + pull/callback/push
│   ├── LiquidatorExecutor.sol       # IBackstopTaker callback — liquidation + WETH push
│   ├── QuoteRegistry.sol            # CRE-forwarder-authenticated quote storage
│   ├── ReceiverTemplate.sol         # Chainlink CRE forwarder auth base
│   └── IReceiver.sol                # Receiver interface
├── test/
│   ├── Phase1Spikes.t.sol           # Privy, CRE, Aqua, liquidation callback spikes
│   ├── Phase2CoreAqua.t.sol         # Happy path + rejection cases
│   ├── Phase3CRE.t.sol              # QuoteRegistry auth + production quote flow
│   └── Phase5FullIntegration.t.sol  # End-to-end mock CRE → Aqua → liquidation
├── script/
│   ├── DeployBackstopApp.s.sol      # Deploy LiquidationBackstopApp
│   └── DeployQuoteRegistry.s.sol    # Deploy QuoteRegistry
└── lib/
    ├── aqua/                        # 1inch Aqua submodule
    └── swap-vm/                     # 1inch SwapVM submodule

frontend/
└── app/
    ├── overview/page.tsx               # Dashboard: Maker Capital, Strategy, Opportunity, Execution, Policy Log
    ├── strategy/page.tsx               # Strategy management: ship, approve, fund wallet
    ├── opportunities/page.tsx          # Live opportunities and execution
    ├── activity/page.tsx               # Activity timeline, policy tests, failure mode lab
    └── providers.tsx                   # Privy provider + Sepolia chain config

cre-workflow/
└── README.md                        # Chainlink CRE confidential workflow template docs
```

## Sponsor Integration Map

| Sponsor | What we built | Key files |
|---------|---------------|-----------|
| **1inch (Aqua)** | Custom `LiquidationBackstopApp` with immutable strategy bounds, atomic `pull()` → callback → `push()` settlement | `contracts/src/LiquidationBackstopApp.sol` (custom AquaApp), `contracts/src/LiquidatorExecutor.sol` (callback), `contracts/test/Phase2CoreAqua.t.sol` (Aqua mechanics) |
| **Chainlink (CRE)** | `QuoteRegistry` with `onlyForwarder` auth, `handlerInTee`-shaped delivery path, mock CRE forwarder for demo | `contracts/src/QuoteRegistry.sol` (forwarder-only writes), `contracts/src/ReceiverTemplate.sol` (CRE auth), `contracts/test/Phase3CRE.t.sol` (quote auth + production flow), `contracts/test/Phase5FullIntegration.t.sol` (end-to-end mock CRE pipeline) |
| **Privy** | Embedded wallet, scoped signer with policy, client-side allowlist, rejection demo | `frontend/app/overview/page.tsx` (login, signer, approve, ship, policy tests), `frontend/app/providers.tsx` (Privy provider config), `contracts/test/Phase1Spikes.t.sol` (Privy spike tests) |
| **Aave (Sepolia)** | Live position reads via `eth_call`; `liquidationCall()` path implemented. **BLOCKER:** Sepolia pool (`0x6Ae43...`) does NOT expose `supply()` in its implementation (`0x0562453c...`). No new borrower positions can be created. | `contracts/src/adapters/AaveV3SepoliaAdapter.sol`, `contracts/test/AaveSepoliaVerification.t.sol`, `contracts/test/AaveV3SepoliaAdapter.t.sol` |
| **Backstop App** | `0xF79BbBC1bB49c4368009B29f963DAF093f65d2C8` on Sepolia; executor: `0xFC5EFBdf44DE64D5496F6e81F96a55e9Eb5cD34B` (LiquidatorExecutor) | `contracts/src/LiquidationBackstopApp.sol` |
| **QuoteRegistry** | `0x75E29B24980f82b8DA80f7EE544D76c1515516dB` on Sepolia | `contracts/src/QuoteRegistry.sol` |
| **LiquidatorExecutor** | `0xFC5EFBdf44DE64D5496F6e81F96a55e9Eb5cD34B` on Sepolia | `contracts/src/LiquidatorExecutor.sol` |
| **AaveV3SepoliaAdapter** | `0xFee5E6F4Aac9FB6B50C238c64C545Ff9a1cA8868` on Sepolia | `contracts/src/adapters/AaveV3SepoliaAdapter.sol` |

## Chainlink CRE Evidence (closed decision)

Per the Chainlink prize page's explicit allowance of "CLI simulation **or** live deployment," this submission uses the following evidence:

1. **CRE CLI simulation** captured at commit `900a8f6` (Sep 7, 2026). The full `handlerInTee` workflow shape, including `runtime.getSecret()` for the private discount curve and `runtime.usingTheDons().writeReport()` delivery, is implemented in `cre-workflow/my-workflow/workflow.ts`.
2. **Live `QuoteRegistry`** deployed on Sepolia at `0x75E29B24980f82b8DA80f7EE544D76c1515516dB` with `onlyForwarder` authentication.
3. **Complete `handlerInTee` workflow source** in `cre-workflow/my-workflow/workflow.ts`.

Live `cre workflow deploy` to Chainlink's staging/production DON is pending private-beta access enrollment. This is **explicitly out of scope for this submission**; the prize rules accept simulation as sufficient evidence, and we are exercising that allowance.

## Demo Flow

1. **Login with Privy** → embedded wallet created on Sepolia
2. **Add Scoped Signer** → signer attached; the demo's disallowed-recipient path is a client-side allowlist, not proof of cryptographic policy enforcement
3. **Fund Wallet** → send test USDC to embedded wallet
4. **Approve Aqua** → maker approves Aqua registry to pull USDC
5. **Ship Strategy** → immutable bounds written to Aqua
6. **Mock CRE delivers quote** → `QuoteRegistry` updated (simulated in UI)
7. **Simulate Swap** → full pipeline: pull USDC → liquidation → push WETH
8. **Policy Tests** → within-policy tx succeeds, disallowed tx blocked client-side

## Failure Modes (all demoable)

| Failure | How to trigger | Expected outcome |
|---------|---------------|------------------|
| Expired quote | Submit quote with `expiry = block.timestamp - 1` | `"Quote expired"` revert |
| Quote size > maxTrade | Submit quote size `2_000e18` with `maxTrade = 1_000e18` | `"Quote size exceeds maxTrade"` revert |
| Price below min discount | Submit quote `price = 50` with `minDiscountBps = 100` | `"Price below min discount"` revert |
| Price above max discount | Submit quote `price = 600` with `maxDiscountBps = 500` | `"Price above max discount"` revert |
| Unauthorized `QuoteRegistry` write | Call `onReport` from non-forwarder address | `InvalidSender` revert |
| Privy policy rejection | Attempt tx to disallowed address | Client-side block + policy log entry |

## Deployment

### Sepolia addresses (from latest broadcast)

> **Audit note:** these artifacts predate the current hardening (executor binding,
> quote-consumer authorization, and strategy-hash binding). Do not use the listed
> Backstop/Registry addresses for a new deployment; redeploy the hardened pair and
> configure their one-time bindings before use.

| Contract | Address |
|----------|---------|
| `LiquidationBackstopApp` | `0xF79BbBC1bB49c4368009B29f963DAF093f65d2C8` |
| `QuoteRegistry` | `0x75E29B24980f82b8DA80f7EE544D76c1515516dB` |
| `LiquidatorExecutor` | `0xFC5EFBdf44DE64D5496F6e81F96a55e9Eb5cD34B` |
| `AaveV3SepoliaAdapter` | `0xFee5E6F4Aac9FB6B50C238c64C545Ff9a1cA8868` |

### Aave V3 Sepolia addresses (verified from aave-dao/aave-address-book)

| Component | Address |
|-----------|---------|
| Pool | `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951` |
| Oracle | `0x2da88497588bf89281816106C7259e31AF45a663` |
| Pool Data Provider | `0x3e9708d80f7B3e43118013075F7e95CE3AB31F31` |
| USDC | `0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8` |
| WETH | `0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c` |
| Chain ID | `11155111` |
| Aqua Registry | `0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a` |

### Deploy

```bash
cd contracts
forge script script/DeployQuoteRegistry.s.sol:DeployQuoteRegistry --rpc-url $SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast
forge script script/DeployBackstopApp.s.sol:DeployBackstopApp --rpc-url $SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast
```

## Live vs Simulated Status

| Component | Status | Evidence |
|-----------|--------|----------|
| **Frontend** | Running on Sepolia; Privy login, scoped signer, client-side allowlist, and Aqua `ship()` are live flows | UI in `frontend/` |
| **Aave V3 Sepolia reads** | Live `eth_call` reads of pool, oracle, and pool-data-provider; no state mutations | `frontend/hooks/useLiveAave.ts`, `contracts/src/adapters/AaveV3SepoliaAdapter.sol` |
| **Aave supply (blocker)** | **Sepolia Aave Pool at `0x6Ae43...` does NOT expose `supply()` in its implementation (`0x0562453c...`).** Comprehensive diagnostics confirm: pool is not paused, WETH is an active reserve, borrower has WETH and allowance, but `supply(address,uint256,address)` and `supply(address,uint256,address,uint16)` both revert with `EvmError: Revert` and no data. No new borrower position can be created on this pool until the Sepolia deployment is updated. | `contracts/script/AaveDiagnostic.s.sol` (removed; findings documented here) |
| **Aave liquidation** | `liquidationCall()` is implemented in `AaveV3SepoliaAdapter.sol` and `LiquidatorExecutor.sol`. Cannot be demonstrated live until a liquidatable position exists. | Solidity implementation + 63/63 Foundry tests |
| **CRE (Chainlink)** | CLI simulation captured; live `cre workflow deploy` pending private-beta access. The prize rules accept simulation as sufficient evidence. | `cre-workflow/my-workflow/workflow.ts` |
| **QuoteRegistry** | Simulated in UI; the onchain registry is deployed but quotes in the demo are mock-generated | `contracts/src/QuoteRegistry.sol` |
| **Atomic settlement (Aqua)** | Proven in Foundry mock/fork tests (63/63 green); not evidenced as a completed live Sepolia transaction | `contracts/test/Phase5FullIntegration.t.sol` |
| **LiquidatorExecutor.execute()** | New public trigger added; allows arbitrary users to initiate liquidation through the Backstop policy layer. Events: `LiquidationRequested`, `LiquidationCompleted`, `LiquidationFailed`. | `contracts/src/LiquidatorExecutor.sol` |

## Known Sepolia Blockers

1. **Aave Pool `supply()` unavailable**: The Sepolia Aave V3 pool (`0x6Ae43...`) implementation (`0x0562453c...`) has `getReserveData` and `getUserAccountData` but NOT `supply`. This means new borrower positions cannot be created. The pool appears to be a limited deployment for reading state and executing liquidations, not for creating new supply positions.
2. **Maker USDC**: Maker `0x659f...` holds 0 USDC at the Aave-book address `0x94a9...`. The 326 USDC at `0x1c7D...` is not recognized by Aave.

## What works (tested)

- All 63 Foundry tests pass (`forge test --via-ir`)
- TypeScript typecheck passes (`npx tsc --noEmit`)
- Frontend build passes (`npm run build`)
- `LiquidatorExecutor.execute()` trigger + full Aqua settlement in mock tests
- QuoteRegistry CRE forwarder authentication
- Replay protection
- Policy validation (discount bounds, size limits, expiry)
- Aave adapter reads (oracle prices, reserve config, user account data, eligibility)

## License

MIT

## Chainlink Liquidation Challenge

- ✅ **Joined** the Automated Liquidation Protection Challenge on Sepolia
- Contract: `0x59d5B29FbA5ca865a171076BE94EbEeC5BCA1E04`
- Tx: `0x4352fbf94cfc602233cdfaf82a05269ecef72b738b0b1206ee61e06e95c4f220`
- Block: `11669067`
- Date: Sept 9, 2026
