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
AaveV3SepoliaAdapter (ILendingAdapter)
   │  getPosition() → healthFactor, collateralUsd, debtUsd
   │  liquidationCall() → real Aave liquidation
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
everything happened in one transaction, on Sepolia, fully verifiable.
```

## Quick Start

### Prerequisites

- [Foundry](https://getfoundry.sh/)
- [Node.js](https://nodejs.org/) + npm
- [Privy](https://privy.io/) account + App ID
- Chainlink CRE CLI + enrollment in Confidential Workflows private beta

### 1. Clone and install

```bash
git clone https://github.com/<your-repo>/backstop.git
cd backstop
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
    ├── page.tsx                     # Dashboard: Maker Capital, Strategy, Opportunity, Execution, Policy Log
    └── providers.tsx                # Privy provider + Sepolia chain config

cre-workflow/
└── README.md                        # Chainlink CRE confidential workflow template docs
```

## Sponsor Integration Map

| Sponsor | What we built | Key files |
|---------|---------------|-----------|
| **1inch (Aqua)** | Custom `LiquidationBackstopApp` with immutable strategy bounds, atomic `pull()` → callback → `push()` settlement | `contracts/src/LiquidationBackstopApp.sol` (custom AquaApp), `contracts/src/LiquidatorExecutor.sol` (callback), `contracts/test/Phase2CoreAqua.t.sol` (Aqua mechanics) |
| **Chainlink (CRE)** | `QuoteRegistry` with `onlyForwarder` auth, `handlerInTee`-shaped delivery path, mock CRE forwarder for demo | `contracts/src/QuoteRegistry.sol` (forwarder-only writes), `contracts/src/ReceiverTemplate.sol` (CRE auth), `contracts/test/Phase3CRE.t.sol` (quote auth + production flow), `contracts/test/Phase5FullIntegration.t.sol` (end-to-end mock CRE pipeline) |
| **Privy** | Embedded wallet, scoped signer with policy, client-side allowlist, rejection demo | `frontend/app/page.tsx` (login, signer, approve, ship, policy tests), `frontend/app/providers.tsx` (Privy provider config), `contracts/test/Phase1Spikes.t.sol` (Privy spike tests) |
| **Aave (Sepolia)** | `AaveV3SepoliaAdapter` reads real health factor and executes real liquidation via `liquidationCall()` | `contracts/src/adapters/AaveV3SepoliaAdapter.sol`, `contracts/src/interfaces/ILendingAdapter.sol`, `contracts/test/AaveSepoliaVerification.t.sol` |

## Demo Flow

1. **Login with Privy** → embedded wallet created on Sepolia
2. **Add Scoped Signer** → policy enforcement active
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

### Sepolia addresses (from broadcast)

| Contract | Address |
|----------|---------|
| `LiquidationBackstopApp` | `0xc258e902262e6110b2dd0d267a6b2ab2e470b539` |
| `QuoteRegistry` | `0xe39e8eC1e77bc9F9E36e552105362F9D5BEe0F95` |

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

## License

MIT
