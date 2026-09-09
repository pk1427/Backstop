# Chainlink — Best Confidential Workflow Feedback

## What we built

A Chainlink CRE confidential workflow integration where a `handlerInTee` computes a quote from the maker's private discount curve and delivers an authenticated onchain result to a `QuoteRegistry` that only accepts writes from the CRE forwarder.

## Sponsor requirement checklist

| Requirement | Evidence |
|-------------|----------|
| `handlerInTee` / `cre.HandlerInTee` registered | Workflow shape defined in `cre-workflow/my-workflow/workflow.ts` with `cre.handlerInTee(...)` and TEE constraints; mock forwarder simulates authenticated `onReport` delivery in tests |
| Sensitive input processed inside enclave | Maker's private discount curve parameters (`minDiscountBps`, `maxDiscountBps`, risk appetite) are the confidential inputs — only `{price, size, expiry}` leaves the enclave |
| Confidential portion meaningfully integrated | `QuoteRegistry` stores CRE-delivered quotes; `LiquidationBackstopApp` reads and validates them against immutable strategy bounds before any token movement |
| CLI simulation or live deployment as evidence | **CLI simulation captured at commit `900a8f6`**; complete `handlerInTee` workflow source in `cre-workflow/my-workflow/workflow.ts`; live Sepolia `QuoteRegistry` at `0xe39e8eC1e77bc9F9E36e552105362F9D5BEe0F95` with `onlyForwarder` auth. Per the prize page's explicit "simulation OR deployment" allowance, this submission uses simulation as its evidence. Live `cre workflow deploy` is pending private-beta access and is **explicitly out of scope** for this submission.

## Key files

| File | Purpose |
|------|---------|
| `contracts/src/QuoteRegistry.sol` | Only the CRE forwarder can write quotes (`onlyForwarder` via `ReceiverTemplate`) |
| `contracts/src/ReceiverTemplate.sol` | Base contract authenticating incoming CRE reports |
| `contracts/src/IReceiver.sol` | Receiver interface for CRE forwarder |
| `contracts/test/Phase3CRE.t.sol` | Forwarder auth tests (`testQuoteRegistry_AuthorizedForwarderCanSubmit`, `testQuoteRegistry_UnauthorizedCannotSubmit`), production quote consumption |
| `contracts/test/Phase5FullIntegration.t.sol` | Full mock CRE pipeline: `vm.prank(forwarder)` → `onReport` → `swap()` → liquidation → push |
| `contracts/script/DeployQuoteRegistry.s.sol` | Deployment script for `QuoteRegistry` |

## Confidentiality boundary

| Protected | Not protected |
|-----------|--------------|
| Maker's private discount curve (`minDiscountBps`, `maxDiscountBps`, risk appetite) | Public inputs: `healthFactor`, `collateralPrice`, `requestedSize` |
| CRE `handlerInTee` execution inside TEE | Workflow source code and binary (revealed to enclave provider) |
| Quote output `{price, size, expiry}` only | — |

## Quote format

```solidity
struct Quote {
    bytes32 quoteId;
    uint256 price;      // discount in basis points
    uint256 size;       // amount to liquidate
    uint64  expiry;     // unix timestamp
    bool    execute;    // execution flag
}
```

## Forwarder authentication

`QuoteRegistry` inherits from `ReceiverTemplate`, which checks `msg.sender == creForwarder`. Any non-forwarder call to `onReport` reverts with `InvalidSender(address,address)` — verified in `Phase3CRE.t.sol:129-135`.

## CRE submission evidence (closed decision)

Per the Chainlink prize page's "simulation OR deployment" allowance, this submission uses:

1. **CRE CLI simulation** — captured at commit `900a8f6` (Sep 7, 2026). The full `handlerInTee` workflow, including `runtime.getSecret()` for the private discount curve and `runtime.usingTheDons().writeReport()` delivery, is implemented in `cre-workflow/my-workflow/workflow.ts`.
2. **Live `QuoteRegistry`** — deployed on Sepolia at `0xe39e8eC1e77bc9F9E36e552105362F9D5BEe0F95` with `onlyForwarder` authentication. Verified in `contracts/test/Phase3CRE.t.sol` and `contracts/test/Phase5FullIntegration.t.sol`.
3. **Complete workflow source** — `cre-workflow/my-workflow/workflow.ts` contains the full `handlerInTee` implementation.

Live `cre workflow deploy` to Chainlink's staging/production DON is pending private-beta access enrollment. This is **explicitly out of scope for this submission**. The prize rules accept simulation as sufficient evidence, and we are exercising that allowance.

## Chainlink Liquidation Challenge

- ✅ **Joined** the Automated Liquidation Protection Challenge
- Contract: `0x59d5B29FbA5ca865a171076BE94EbEeC5BCA1E04`
- Tx: `0x4352fbf94cfc602233cdfaf82a05269ecef72b738b0b1206ee61e06e95c4f220`
- Block: `11669067`
- Date: Sept 9, 2026
