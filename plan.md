# Confidential Liquidation Backstop — Build Plan
*ETHOnline 2026 · Build window: Sept 4–16 · Target: 9-day build*

> **Product thesis:** A self-custodial, privately-priced, policy-bounded, programmable liquidation-liquidity position. The maker's capital never leaves their wallet until the exact moment a real liquidation opportunity clears their (private) risk bar. Aave/mock-lending is **not the product** — it is only the event generator used to demonstrate the mechanism.

---

## 1. Locked architecture

```
PRIVY (policy-scoped embedded wallet)
   │  ship() — USDC virtual balance, immutable hard bounds
   ▼
AQUA STRATEGY (immutable once shipped)
   │  pair: USDC/WETH · maxTrade · minDiscount/maxDiscount · expiry · maker · salt
   │
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
   │  spends the pulled USDC to call the Aave-fork's liquidationCall()
   │  receives WETH collateral in return
   │
   └─ aqua.push(maker, app, strategyHash, WETH, amountReceived)       ← maker's INPUT leg
   ▼
ATOMIC SETTLEMENT COMPLETE
Maker's wallet now holds WETH it didn't have before; USDC it approved is gone;
everything happened in one transaction, on a fork, fully demoable.
```

**Non-negotiable technical facts baked into this design:**
- Aqua's `pull()` moves the maker's **output** token (what they're giving away) to the taker. Aqua's `push()` moves the taker's **input** token back into the maker's balance. The maker shipped only USDC → USDC is the pull leg, WETH is the push leg. (Do not reverse this — it was the one real bug in an earlier draft of this plan.)
- Aqua strategies are **immutable once shipped**. Only hard, never-changing guardrails live in the strategy hash. The CRE-computed per-event price/size is *runtime data*, delivered separately and checked against those guardrails at execution time.
- `QuoteRegistry` must only accept writes from the CRE forwarder contract (check `msg.sender`) — never an open `setQuote(id, price, size)`.
- Custom AquaApp and `AquaSwapVMRouter`/SwapVM composition are **two different integration paths**, not the same thing. Build the custom AquaApp first; attempt SwapVM composition only as a scored bonus, never conflate the two in the code.

---

## 2. Sponsor role map

| Sponsor | Exact job | What breaks if removed |
|---|---|---|
| **1inch (Aqua/SwapVM)** | Self-custodial liquidity position + programmable execution/pricing enforcement | No product — this is the mandatory core |
| **Chainlink (CRE, Confidential Workflow)** | Private risk/discount-curve decision computed inside a TEE (`handlerInTee`), delivered as an authenticated onchain quote | Maker's proprietary strategy becomes public / front-runnable; confidentiality thesis collapses |
| **Privy** | Embedded wallet + scoped signer/policy authorizing *only* bounded automated actions (max trade, max exposure, allowed contract, expiry) | Loses the clean "self-custodial but safely automatable" authorization story |

---

## 3. Exact prize targets

| Priority | Sponsor | Prize | Amount | Key qualification facts |
|---|---|---|---|---|
| Primary | 1inch | Build an Aqua App | $5,000 (2.5k/1.5k/1k) | Official Aqua/SwapVM contracts (modified SwapVM redeploys allowed); real onchain token transfer at demo (fork OK); continuous Git history from Day 1 (no single-commit final day) |
| Primary | Chainlink | Best Confidential Workflow | $2,000 (up to 2×$1,000) | Must register `handlerInTee`/`cre.HandlerInTee`; must process a genuinely sensitive input inside the enclave; confidential portion must be *meaningfully integrated*, not a placeholder; CLI simulation **or** live deployment both count as evidence |
| Secondary | Privy | Best Financial Flow | $2,500 | Needs ≥1 functional flow using a generally-available Privy feature; **transfers are explicitly eligible** — make sure the USDC that funds the Aqua position visibly moves *from* the Privy wallet |
| Secondary | Privy | Best B2B Financial Product | $2,500 | Needs a business/org use case + ≥1 Privy control (policy/signer/quorum/intent) + a functional B2B workflow — the scoped-signer spend policy already satisfies this |
| Optional (bonus) | Chainlink | Automated Liquidation Protection Challenge | $500 | **Separate scoring event.** Requires calling `join()` on the official Sepolia contract `0x59d5B29FbA5ca865a171076BE94EbEeC5BCA1E04`, **only between Sept 8 and the submission deadline**. Cannot be replayed live in your demo — attempt only after the core product works. |
| Not pursued | Chainlink | Chainlink-Powered Upgrade | $500 | Continuity Track only — not eligible for a fresh 9-day build |
| Not pursued | 1inch | Aqua App — Continuity Track | $2,000 | Continuity Track only |

**⚠️ Calendar item, independent of everything else: `join()` the liquidation challenge contract starting Sept 8. Missing this window forfeits the $500 regardless of how good the workflow is.**

---

## 4. Feasibility spikes — Day 1–2 (go/no-go gate)

Run in this order. Do **not** start UI work until all four are green.

| Spike | Prove | Fallback if it fails |
|---|---|---|
| **A — Privy** | Privy embedded wallet + policy-scoped signer can call `ship()`; an out-of-policy transaction is actually rejected | Loosen policy granularity but keep at least one real enforced limit |
| **B — Chainlink CRE** | `handlerInTee` runs with a private secret input and produces an authenticated result written to a contract you control (via CRE forwarder) | If live delivery is unreliable, use CRE CLI simulation output + logs as demo evidence (explicitly allowed) |
| **C — Aqua** | `ship()` → `pull()`/`push()` executes atomically on a fork with a **hardcoded** price (no CRE, no Aave yet) | N/A — if this fails, the whole architecture needs rethinking before Day 3 |
| **D — Liquidation callback** | `LiquidatorExecutor.aquaAppSwapCallback()` can call the Aave-fork's `liquidationCall()` mid-callback and successfully `push()` the resulting WETH back | **Switch to the two-transaction fallback** (below) immediately — don't wait until Day 6–7 to discover this |

**Two-transaction fallback (if Spike D fails):** Liquidator liquidates the Aave-fork position first using its own capital, receives WETH, then in a *separate* transaction sells that WETH to the Aqua backstop position (CRE still prices the trade). You lose the single-atomic-transaction wow factor but keep every sponsor integration intact and still show real onchain token transfers.

---

## 5. MVP scope

**MUST BUILD**
- Custom `LiquidationBackstopApp` AquaApp with immutable strategy bounds (pair, maxTrade, min/max discount, expiry)
- Real Privy embedded wallet + scoped signer/policy; one deliberate policy-rejection demo moment
- Real CRE `handlerInTee` workflow: private discount curve → authenticated quote delivered onchain
- `QuoteRegistry` that only accepts CRE-forwarder-authenticated writes
- Full pull → callback → push atomic settlement (or the two-transaction fallback)
- Mock Aave-style lending position as the liquidation-event source
- Minimal dashboard showing: maker capital (in-wallet), live opportunity, quote, execution result, transaction hash

**SHOULD BUILD**
- A second, lower-trust/out-of-policy scenario shown for contrast (Privy blocks it)
- FEEDBACK.md-equivalent documentation per sponsor (Uniswap-style hygiene is good practice generally)
- Attempt at composing the pricing bound-check through `AquaSwapVMRouter`/existing SwapVM instructions (bonus scoring)

**NICE TO HAVE**
- Join the Chainlink Automated Liquidation Protection Challenge (Sept 8+)
- Second collateral asset / multiple concurrent strategies

**DO NOT BUILD**
- A general liquidation protocol or multi-asset engine
- New SwapVM opcodes (only attempt if Days 1–6 go unusually smoothly)
- Any token, governance, or DAO layer
- Multi-chain support
- Mobile app
- Real Aave mainnet integration — fork/mock only

---

## 6. 9-day build plan

| Day | Deliverable |
|---|---|
| 1 | Spikes A, B, C independently green |
| 2 | Spike D attempted; go/no-go decision on atomic vs. two-transaction design |
| 3 | First ugly end-to-end vertical slice: opportunity → CRE quote → Aqua settlement |
| 4 | Harden 1inch integration: real Git history from here forward, fork-demoable token transfer, README |
| 5 | Harden CRE: real discount-curve logic (not a flat number), authenticated delivery finalized |
| 6 | Harden Privy: policy limits finalized, rejection scenario built and reliable |
| 7 | Failure-mode pass: expired quote, out-of-bounds quote, policy rejection, all with clear UI states |
| 8 | Demo-first UI polish, full rehearsal, attempt Chainlink liquidation challenge `join()` if ahead of schedule |
| 9 | Final testing, README/docs/FEEDBACK files, demo recording, submission, backup recording |

---

## 7. Demo script (2–3 minutes)

1. **Problem (0:00–0:20):** Maker's $100k USDC sits in their own wallet — not in a vault — waiting to backstop a real liquidation.
2. **Setup (0:20–0:40):** Show the Aqua strategy's immutable bounds and the Privy policy limiting what can auto-execute.
3. **Trigger (0:40–1:00):** Collateral price crashes; the mock position's health factor drops below 1.
4. **Confidential decision (1:00–1:30):** CRE's TEE computes a quote from the maker's *private* discount curve — show that only `{price, size, expire}` ever leaves the enclave, never the curve itself.
5. **Execution (1:30–2:00):** Atomic settlement fires live — USDC leaves the maker's wallet, WETH arrives, transaction hash shown on the fork explorer.
6. **Judge moment (2:00–2:30):** A second, out-of-policy attempt is shown being **rejected by Privy** even though CRE approved it — proof the three sponsors are independent, necessary checks, not decoration.
7. **Why it matters (2:30–3:00):** This is a general primitive for privately-priced, policy-bounded, self-custodial liquidity — liquidations are just the first market.

---

## 8. Open risks to track

- CRE forwarder address/interface must be pulled from the actual template repo on Day 1 — do not guess it.
- Confirm whether `AquaSwapVMRouter` composition is worth attempting only after the custom AquaApp path is fully working — never let it block the core path.
- The Chainlink liquidation challenge scenario is scored **after** submission by Chainlink's own team — it cannot be shown live, so it must never be the centerpiece of the main demo video.