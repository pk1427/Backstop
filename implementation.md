# Confidential Liquidation Backstop — Phase-Wise Implementation Plan
*Companion to plan.md. This document breaks the locked architecture into concrete, engineer-ready phases with tasks, file/contract skeletons, and Definition-of-Done (DoD) checkpoints for each.*

---

## PHASE 0 — Repo & Environment Setup
**Day: 0 (before Day 1 officially starts, or first hours of Day 1)**

### Tasks
- [ ] Init monorepo: `contracts/`, `cre-workflow/`, `backend/`, `frontend/`, `test/`, `scripts/`
- [ ] Foundry project in `contracts/` — `forge init`, add remappings for Aqua/SwapVM
- [ ] `git submodule add https://github.com/1inch/aqua contracts/lib/aqua`
- [ ] `git submodule add https://github.com/1inch/swap-vm contracts/lib/swap-vm`
- [ ] Fork target chain locally: `anvil --fork-url <RPC> --fork-block-number <N>`
- [ ] Deploy or point to the canonical Aqua registry address on the fork
- [ ] Set up Privy app (dashboard), get App ID + secret, install `@privy-io/server-auth` / client SDK
- [ ] Set up Chainlink CRE CLI, clone `cre-templates` repo, locate `confidential-workflows` starter template
- [ ] **Commit immediately and commit often from this point on** — 1inch explicitly penalizes single-commit final-day submissions

### Definition of Done
- Fork running locally with Aqua registry reachable
- Foundry test suite runs (even empty) against the fork
- CRE CLI can run the "Hello Confidential Workflow" template end-to-end locally
- Privy test app created, sandbox login works in a blank React page

---

## PHASE 1 — Feasibility Spikes (go/no-go gate)
**Day: 1–2 — do not proceed to Phase 2 until this phase's DoD is met**

### Spike A — Privy scoped policy
- [ ] Create embedded wallet via Privy for a test maker
- [ ] Define a policy: allowed contract = a placeholder address, max value = X, expiry = 24h
- [ ] Attach policy to a scoped session signer
- [ ] Send one transaction *within* policy → confirm success
- [ ] Send one transaction *outside* policy (wrong contract or over limit) → confirm rejection
- **DoD:** both the success and the rejection are reproducible and logged

### Spike B — Chainlink CRE confidential handler
- [ ] Start from the `confidential-workflows` starter template
- [ ] Register a `handlerInTee` function that reads one dummy "private" input (a hardcoded secret via CRE's secrets mechanism)
- [ ] Produce an output value and confirm it's delivered — either onchain via the CRE forwarder to a scratch contract, or via CLI simulation with captured logs
- [ ] Identify and record the **exact forwarder contract address/interface** used for authenticated onchain delivery — do not guess this
- **DoD:** one real (or simulated) `handlerInTee` run produces a value you can point to in logs or onchain state

### Spike C — Aqua ship/pull/push (hardcoded price, no CRE, no Aave)
- [ ] Write a minimal `TestAquaApp` implementing the app interface
- [ ] Fund a test maker EOA with mock USDC, approve Aqua registry
- [ ] Call `aqua.ship({app: TestAquaApp, strategy: encode(pair, maxTrade), amountsAndTokens: [{USDC, amount}]})`
- [ ] Write a `TestTaker` implementing `IAquaAppSwapCallback`
- [ ] Execute one full swap: `pull(maker, strategyHash, USDC, size, taker)` → callback → `push(maker, app, strategyHash, WETH, amount)`
- [ ] Confirm on the fork: maker's USDC balance decreased, WETH balance increased, in one atomic tx
- **DoD:** one successful hardcoded-price swap, fully atomic, verifiable via fork trace

### Spike D — Liquidation callback composition
- [ ] Deploy a minimal Aave-fork-compatible lending pool (or a simple mock with a `liquidationCall()`-shaped function) with one under-collateralized position
- [ ] Inside `TestTaker`'s callback (from Spike C), call the mock `liquidationCall()` using the pulled USDC, receive WETH
- [ ] Push the received WETH back to the maker via `aqua.push()`, still inside the same callback
- [ ] Confirm the full chain executes in one transaction
- **DoD:** if this works, lock the atomic design. **If it fails or is unreliable by end of Day 2, immediately switch to the two-transaction fallback documented in plan.md and update this file's Phase 4 accordingly — do not keep debugging past the Day 2 boundary.**

### Phase 1 exit gate
```
✅ Privy policy enforcement — real accept + real reject
✅ CRE handlerInTee — real or simulated authenticated output
✅ Aqua ship/pull/push — atomic, hardcoded price
✅ / ⚠️ Liquidation callback — atomic (proceed) or flagged for fallback (adjust plan)
```
Do not start Phase 2 until at least the first three are checked.

---

## PHASE 2 — Core Aqua Mechanics (Custom AquaApp)
**Day: 3**

### Tasks
- [ ] Design the immutable `Strategy` struct:
  ```solidity
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
  ```
- [ ] Implement `LiquidationBackstopApp` (custom AquaApp):
  - `swap(bytes32 strategyHash, Strategy calldata strategy, uint256 quoteId, bytes calldata takerData)`
  - Reads `QuoteRegistry[quoteId]`, checks `price` within `[minDiscountBps, maxDiscountBps]`, `size <= maxTrade`, `block.timestamp <= expiry`
  - Calls `aqua.pull(strategy.maker, strategyHash, USDC, quotedSize, msg.sender)`
  - Expects taker's callback to complete with `aqua.push(strategy.maker, address(this), strategyHash, WETH, amountReceived)` before returning
- [ ] Implement `LiquidatorExecutor` implementing `IAquaAppSwapCallback`:
  - Receives pulled USDC
  - Calls mock lending pool's liquidation function
  - Receives WETH
  - Calls `aqua.push(...)`
- [ ] Wire the real (non-mock) mock-lending contract from Spike D into this flow
- [ ] Write Foundry tests: happy path, expired quote (revert), over-max-trade (revert), out-of-discount-bounds (revert)

### Definition of Done
- `forge test` passes for: successful atomic swap, and all three rejection cases
- Fork trace clearly shows USDC leaving maker → WETH arriving at maker, in one tx

---

## PHASE 3 — Chainlink CRE Confidential Workflow (Production Version)
**Day: 4–5**

### Tasks
- [ ] Model the maker's private discount curve as a function, e.g. `discount(healthFactor) = f(minDiscountBps, maxDiscountBps, riskAppetite)` — start with a simple linear or step curve, not a placeholder constant
- [ ] Store the maker's private parameters via CRE's secrets mechanism (never hardcode them in workflow source)
- [ ] `handlerInTee` workflow:
  - Public inputs: `healthFactor`, `collateralPrice`, `requestedSize`
  - Private inputs (fetched inside enclave): maker's curve parameters
  - Output: `{quoteId, execute, price, size, expiry}`
- [ ] Deliver the output onchain via the CRE forwarder to `QuoteRegistry`
- [ ] Implement `QuoteRegistry`:
  ```solidity
  contract QuoteRegistry {
      address public immutable creForwarder;
      mapping(bytes32 => Quote) public quotes;

      modifier onlyForwarder() {
          require(msg.sender == creForwarder, "unauthorized");
          _;
      }

      function submitQuote(bytes32 quoteId, Quote calldata q) external onlyForwarder {
          quotes[quoteId] = q;
      }
  }
  ```
- [ ] Connect `LiquidationBackstopApp` to read from this real `QuoteRegistry` instead of the Spike B scratch contract
- [ ] Test: verify a write from a non-forwarder address reverts

### Definition of Done
- End-to-end: a real health-factor input triggers a CRE run, produces a quote, and that quote is only writable by the forwarder
- At least one demo run captured as video/logs showing the private curve parameters never appear outside the enclave

---

## PHASE 4 — Privy Wallet + Policy (Production Version)
**Day: 6**

### Tasks
- [ ] Build the maker onboarding flow: Privy embedded wallet creation, funding with test USDC
- [ ] Define the production policy:
  - Allowed contract: `LiquidationBackstopApp` address (and `Aqua` registry for `ship()`/`approve()`)
  - Max per-trade: matches `maxTrade` in the shipped strategy
  - Max cumulative exposure: e.g. 50% of total capital per 24h window (stateful policy)
  - Expiry matching the strategy's expiry
- [ ] Wire the maker's `approve()` and `ship()` calls to go through the Privy-scoped signer
- [ ] Build the explicit rejection demo scenario: attempt a `ship()` or manual override that exceeds policy limits and confirm Privy blocks it before it reaches the chain
- [ ] Identify the exact transaction that satisfies Privy's "Best Financial Flow" transfer requirement — make sure the USDC funding transaction is visibly signed and sent by the Privy wallet itself, and capture it separately in the demo

### Definition of Done
- Full maker journey works: onboard → fund → configure policy → ship strategy, all through Privy
- One recorded rejection event, one recorded successful transfer event, clearly distinguishable in the demo

---

## PHASE 5 — Full Integration
**Day: 7 (start), rolls into Day 8 buffer if needed**

### Tasks
- [ ] Connect all three sponsor integrations into the single pipeline described in plan.md's architecture diagram
- [ ] Run the full sequence live on the fork: mock liquidation event → CRE quote → Privy-authorized position → Aqua atomic settlement
- [ ] If Phase 1's Spike D fallback was triggered, implement the two-transaction version here instead of the atomic callback
- [ ] Load-test with 2–3 different scenarios (varying health factor, varying discount curve output) to confirm the bounds-checking logic behaves correctly across the range

### Definition of Done
- One command/script (`scripts/run-demo-scenario.ts` or similar) reliably reproduces the full end-to-end flow from a clean fork state
- At least 3 consecutive successful runs with no manual intervention

---

## PHASE 6 — Failure Modes
**Day: 7–8**

### Tasks
- [ ] Build and visibly surface (in UI/logs) each of:
  - Expired quote → execution blocked
  - Quote outside immutable discount bounds → execution blocked
  - Quote size exceeding `maxTrade` → execution blocked
  - Privy policy violation → transaction never reaches the chain
  - Unauthenticated write attempt to `QuoteRegistry` → reverts
- [ ] Each failure mode should produce a distinct, demoable state (not a generic error toast)

### Definition of Done
- Every failure mode above can be triggered on demand during a live demo and shows a clear, distinct outcome

---

## PHASE 7 — Demo-First UI
**Day: 8–9 (start)**

### Tasks
- [ ] Single dashboard page with sections: Maker Capital (in-wallet balance), Active Strategy (immutable bounds displayed), Live Opportunity (health factor, incoming quote), Execution Result (tx hash, before/after balances), Policy Log (accept/reject events)
- [ ] Wire real-time updates (polling or events) so state transitions are visible without manual refresh
- [ ] No auth flows, no unrelated pages, no settings screens beyond what's needed for the demo

### Definition of Done
- A person unfamiliar with the project can watch the dashboard during the scripted demo and follow what's happening without narration alone

---

## PHASE 8 — Prize Audit & Documentation
**Day: 9 (mid)**

### Checklist per sponsor
- [ ] **1inch:** public repo, continuous commit history verified, onchain token transfer demonstrable on fork, README pointing to exact contract/lines
- [ ] **Chainlink:** `handlerInTee` registration visible in code, sensitive input clearly identified in README, simulation/deployment evidence attached (video, logs, or execution trace)
- [ ] **Privy:** wallet integration core to the flow, ≥1 control (policy) demonstrated, ≥1 functional flow (the transfer) demonstrated, source code accessible
- [ ] **(Optional) Chainlink Liquidation Challenge:** confirm `join()` was called on `0x59d5B29FbA5ca865a171076BE94EbEeC5BCA1E04` within the Sept 8–deadline window
- [ ] README covers: architecture diagram, setup instructions, per-sponsor integration pointers
- [ ] Demo video recorded per the script in plan.md, 2–4 minutes, within any sponsor-specific length limits

### Definition of Done
- Every checklist item above is checked off with a specific file/line/link reference, not "should be fine"

---

## PHASE 9 — Submission
**Day: 9 (end) / Day 10 buffer if available**

### Tasks
- [ ] Final end-to-end smoke test on a fresh fork/clean state
- [ ] Record backup demo take
- [ ] Submit to ETHGlobal under the correct track (Start Fresh / Classic, not Continuity)
- [ ] Double-check open-source license present in repo
- [ ] Submit any required sponsor-specific forms/feedback docs

### Definition of Done
- Submission confirmed on the ETHGlobal platform with all links live and repo public

---

## Phase-to-Day Summary

| Phase | Days | Blocking? |
|---|---|---|
| 0 — Setup | 0 | Yes — nothing starts without this |
| 1 — Spikes | 1–2 | **Yes — hard go/no-go gate** |
| 2 — Core Aqua | 3 | Depends on Phase 1 |
| 3 — CRE production | 4–5 | Depends on Phase 1 Spike B |
| 4 — Privy production | 6 | Depends on Phase 1 Spike A |
| 5 — Full integration | 7 | Depends on Phases 2–4 |
| 6 — Failure modes | 7–8 | Depends on Phase 5 |
| 7 — Demo UI | 8–9 | Can start in parallel once Phase 5 is stable |
| 8 — Prize audit | 9 | Depends on everything above |
| 9 — Submission | 9–10 | Final |