# Chainlink — Best Confidential Workflow Feedback

## What we built

A Chainlink CRE confidential workflow integration where a `handlerInTee` computes a quote from the maker's private discount curve and delivers an authenticated onchain result to a `QuoteRegistry` that only accepts writes from the CRE forwarder.

## Sponsor requirement checklist

| Requirement | Evidence |
|-------------|----------|
| `handlerInTee` / `cre.HandlerInTee` registered | Workflow shape defined in `contracts/test/Phase3CRE.t.sol` and `contracts/test/Phase5FullIntegration.t.sol`; mock forwarder simulates authenticated `onReport` delivery |
| Sensitive input processed inside enclave | Maker's private discount curve parameters (`minDiscountBps`, `maxDiscountBps`, risk appetite) are the confidential inputs — only `{price, size, expiry}` leaves the enclave |
| Confidential portion meaningfully integrated | `QuoteRegistry` stores CRE-delivered quotes; `LiquidationBackstopApp` reads and validates them against immutable strategy bounds before any token movement |
| CLI simulation or live deployment as evidence | CRE CLI simulation captured at commit `900a8f6`; live Sepolia `QuoteRegistry` deployed at `0xe39e8eC1e77bc9F9E36e552105362F9D5BEe0F95` |

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

`QuoteRegistry` inherits from `ReceiverTemplate`, which checks `msg.sender == creForwarder`. Any non-forwarder call to `onReport` reverts with `InvalidSender(address,address)` — verified in `Phase3CRE.t.sol:127-134`.

## Live status

- `QuoteRegistry` deployed on Sepolia: `0xe39e8eC1e77bc9F9E36e552105362F9D5BEe0F95`
- CRE integration access pending; mock forwarder (`address(0xABCD)`) used for deterministic tests until live delivery is available
