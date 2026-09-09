# Privy — Best Financial Flow / Best B2B Product Feedback

## What we built

A self-custodial maker flow using Privy embedded wallets with a scoped signer and policy that bounds exactly which contracts, amounts, and actions the wallet can autonomously execute.

## Sponsor requirement checklist

| Requirement | Evidence |
|-------------|----------|
| ≥1 functional flow using a generally-available Privy feature | Embedded wallet creation, `addSigners()` with auth key + policy, `sendTransaction()` through scoped signer — all in `frontend/app/overview/page.tsx` |
| Transfers are explicitly eligible | USDC `approve()` and `ship()` transactions visibly signed and sent by the Privy embedded wallet |
| ≥1 Privy control (policy/signer/quorum/intent) | Scoped signer with policy IDs enforced client-side; rejection of disallowed transactions logged in Policy Log |
| ≥1 functional B2B workflow | Scoped signer spend policy already satisfies B2B use case — bounded automated liquidation backstop for institutions |
| Continuous Git history | Privy integration commits: `6a1d4dc`, `c4b7ff2`, `992ac82`, `177e2a0`, `509fe6a` |

## Key files

| File | Purpose |
|------|---------|
| `frontend/app/overview/page.tsx` | Login, embedded wallet display, balance polling, scoped signer creation, approve/ship/policy-test buttons, Policy Log section |
| `frontend/app/providers.tsx` | `PrivyProvider` config with Sepolia chain, embedded wallet creation on login |
| `contracts/test/Phase1Spikes.t.sol` | Privy spike tests: policy allow/block addresses |

## Flow walkthrough

1. **Login with Privy** → embedded wallet created (`overview/page.tsx:66-69`)
2. **Add Scoped Signer** → `addSigners({ address, signers: [{ signerId, policyIds }] })` (`overview/page.tsx:118-143`)
3. **Approve Aqua** → ERC-20 `approve()` sent through scoped signer (`overview/page.tsx:207-220`)
4. **Ship Strategy** → `aqua.ship()` calldata encoded and sent through scoped signer (`overview/page.tsx:222-255`)
5. **Policy Tests**:
   - **Within-policy tx**: zero-value USDC transfer to self succeeds (`overview/page.tsx:257-268`)
   - **Outside-policy tx**: transfer to disallowed address blocked client-side (`overview/page.tsx:270-283`)

## Policy enforcement

| Layer | Mechanism | Where |
|-------|-----------|-------|
| Client-side allowlist | `enforceClientAllowlist` checks `to` against `[AQUA_REGISTRY, BACKSTOP_APP_ADDRESS, ALLOWED_ADDRESS, USDC_ADDRESS]` | `overview/page.tsx:176-181` |
| Privy server-side policy | Scoped signer with `policyIds` — enforced by Privy Wallet API | `overview/page.tsx:123-129` |
| Policy Log UI | Every accept/reject event timestamped and displayed | `overview/page.tsx:402-411` (Policy Log section) |

## Demo moments

| Moment | What the viewer sees |
|--------|----------------------|
| Successful transfer | "Transaction succeeded" + updated USDC balance |
| Policy rejection | "Transaction blocked by client-side allowlist" in red + Policy Log entry |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Yes | Privy App ID |
| `NEXT_PUBLIC_PRIVY_AUTH_KEY_ID` | Yes | Auth key ID for scoped signer |
| `NEXT_PUBLIC_PRIVY_POLICY_ID` | Yes | Policy ID created in Privy Dashboard |
| `NEXT_PUBLIC_ALLOWED_ADDRESS` | No | Extra address to allow in client-side allowlist |
