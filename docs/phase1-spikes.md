# Phase 1 — Feasibility Spikes Report

## Spike A — Privy Scoped Policy (Accept / Reject)

### Status: BLOCKED — Manual Privy Dashboard Configuration Required

### What is implemented
- Next.js app scaffolded with `@privy-io/react-auth`
- Embedded wallet creation flow wired
- Login page displays embedded wallet address
- `.env.local` stores `NEXT_PUBLIC_PRIVY_APP_ID` and `PRIVY_APP_SECRET`

### What is NOT yet implemented (blocking)
Privy policies and scoped session signers require **manual configuration in the Privy Dashboard**:
1. **App Authorization Key**: Create an authorization key in the Privy Dashboard (Settings → Authorization Keys). Save the private key securely.
2. **Policy**: Create a policy with:
   - `allowed_contracts`: `["0xPlaceholder..."]` (the backstop app address)
   - `max_value`: e.g., `1000000000000000000` (1 ETH or equivalent)
   - `expiry`: 24h from creation
3. **Add Signer**: After user login, call `addSigners()` with the authorization key ID and policy ID.

### Exact verification steps (once Dashboard is configured)
1. User logs in → embedded wallet created
2. App calls `addSigners()` with the scoped policy
3. Send a transaction to the allowed contract under the max value → **expect success**
4. Send a transaction to a different contract or over the max value → **expect rejection**
5. Both outcomes must be logged/reproducible

### Evidence location
- Frontend scaffold: `frontend/app/providers.tsx`, `frontend/app/page.tsx`
- Policy setup instructions: this document
- **Missing**: actual policy ID, authorization key ID, and verified accept/reject traces

---

## Spike B — Chainlink CRE Confidential Handler (handlerInTee)

### Status: PASS — Simulation Verified

### What was done
1. Installed CRE CLI v1.32.0
2. Copied `hello-confidential-workflows-ts` template into `cre-workflow/my-workflow/`
3. Ran `cre workflow build my-workflow` — succeeds
4. Ran `cre workflow simulate my-workflow --target staging-settings` — succeeds
5. Captured full output to `cre-workflow/spike-output.log`

### Simulation output (from `cre-workflow/spike-output.log`)
```
✓ Workflow compiled
✓ Workflow Simulation Result:
"REJECT (score: 349, secret reached API: true)"
```

### Forwarder address (official source: Chainlink CRE Forwarder Directory)
- **Network**: Ethereum Sepolia (staging-settings target)
- **Forwarder**: `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`
- **Source**: https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory

### DoD check
- ✅ One `handlerInTee` run produces a value visible in logs
- ✅ Forwarder address identified and recorded from official docs

---

## Spike C — Aqua Ship / Pull / Push Atomic Swap

### Status: PASS — Foundry Test Verified

### What was implemented
- `BackstopApp` (extends `AquaApp`) — `swap()` pulls USDC from maker, calls taker callback, verifies WETH push
- `SimpleTaker` (implements `IBackstopTaker`) — callback pushes hardcoded 1:1 WETH back to maker
- Mock ERC20s for USDC and WETH
- Foundry test `testSpikeC_ShipPullPushAtomic()` proves:
  1. Maker ships USDC strategy
  2. Taker pulls USDC from maker
  3. Callback pushes WETH to maker
  4. Swap is atomic (all in one transaction)
  5. Aqua balances updated correctly

### Test evidence
- **File**: `contracts/test/Phase1Spikes.t.sol:183`
- **Result**: `[PASS] testSpikeC_ShipPullPushAtomic() (gas: 138084)`
- **Traces show**:
  - `Aqua::pull` transfers 1e21 USDC from maker to SimpleTaker
  - `SimpleTaker::backstopCallback` approves Aqua and calls `Aqua::push`
  - `Aqua::push` transfers 1e21 WETH from SimpleTaker to maker
  - Final balances verified:
    - Maker USDC: 9e21 (started 10e21, pulled 1e21)
    - Maker WETH: 11e21 (started 10e21, pushed 1e21)
    - Aqua USDC balance: 4e21 (started 5e21, pulled 1e21)
    - Aqua WETH balance: 1e21 (pushed 1e21)

---

## Spike D — Liquidation Callback Composition (Atomic)

### Status: PASS — Foundry Test Verified

### What was implemented
- `LiquidatorTaker` (implements `IBackstopTaker`) — callback:
  1. Decodes liquidation params from `takerData`
  2. Calls `MockLendingPool.liquidationCall()` with pulled USDC
  3. Receives WETH collateral from mock Aave pool
  4. Pushes resulting WETH to maker via `Aqua::push`
- `MockLendingPool` — simulates Aave liquidation:
  - `fundBorrower()` creates under-collateralized position
  - `liquidationCall()` seizes collateral (1:1 ratio for spike)
  - `healthFactor()` for verification

### Test evidence
- **File**: `contracts/test/Phase1Spikes.t.sol:218`
- **Result**: `[PASS] testSpikeD_LiquidationCallbackInSameTransaction() (gas: 305574)`
- **Traces show**:
  - Borrower funded with 2e21 WETH collateral, 3e21 USDC debt (HF = 0.66, under-collateralized)
  - `BackstopApp::swap` pulls 1e21 USDC from maker to LiquidatorTaker
  - `LiquidatorTaker::backstopCallback`:
    - Calls `MockLendingPool::liquidationCall` → seizes 1e21 WETH from borrower
    - Approves Aqua for 1e21 WETH
    - Calls `Aqua::push` → transfers 1e21 WETH from LiquidatorTaker to maker
  - Final state verified:
    - Maker WETH: 11e21 (10e21 + 1e21 seized)
    - Aqua WETH balance: 1e21
    - Borrower debt: 2e21 (repaid 1e21)
    - Borrower collateral: 1e21 (seized 1e21)

### DoD check
- ✅ Mock liquidation + WETH push happen in the same transaction as the Aqua pull
- ✅ Full chain verified in one `BackstopApp::swap` call

---

## Summary Table

| Spike | Status | Evidence location | Notes |
|-------|--------|-------------------|-------|
| A — Privy policy | **BLOCKED** | `frontend/app/providers.tsx`, `frontend/app/page.tsx` | Requires manual Privy Dashboard config: app auth key + policy creation. Code is ready; verification blocked pending Dashboard setup. |
| B — CRE handlerInTee | **PASS** | `cre-workflow/spike-output.log`, forwarder: `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` (Ethereum Sepolia) | Simulation output captured. Forwarder address from official Chainlink CRE docs. |
| C — Aqua ship/pull/push | **PASS** | `contracts/test/Phase1Spikes.t.sol:183` | Atomic swap verified on fork. USDC pulled, WETH pushed, balances correct. |
| D — Liquidation callback | **PASS** | `contracts/test/Phase1Spikes.t.sol:218` | Mock Aave liquidation + WETH push atomic in same transaction. Borrower position updated correctly. |

---

## Next Steps

1. **Spike A**: Complete Privy Dashboard setup (auth key + policy), then run the frontend and verify accept/reject traces.
2. **Spike B**: Consider deploying a scratch consumer contract to test real onchain delivery (vs. simulation only).
3. **Spike C/D**: These are fully verified. Proceed to Phase 2 contract work once Spike A is unblocked.
