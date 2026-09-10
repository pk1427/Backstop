# Privy — Best Financial Flow / Best B2B Product Feedback

## What we built

A self-custodial maker flow using Privy embedded wallets with a scoped signer and policy that bounds exactly which contracts, amounts, and actions the wallet can autonomously execute.

## Sponsor requirement checklist

| Requirement | Evidence |
|-------------|----------|
| ≥1 functional flow using a generally-available Privy feature | Embedded wallet creation, `addSigners()` with auth key + policy, `sendTransaction()` through scoped signer — all in `frontend/context/BackstopContext.tsx` |
| Transfers are explicitly eligible | USDC `approve()` and `ship()` transactions visibly signed and sent by the Privy embedded wallet |
| ≥1 Privy control (policy/signer/quorum/intent) | Embedded wallet and scoped signer attachment are implemented. The rejection demo is a client-side allowlist block before broadcast, not cryptographic authorization-key or server-side policy proof. |
| ≥1 functional B2B workflow | Scoped signer spend policy already satisfies B2B use case — bounded automated liquidation backstop for institutions |
| Continuous Git history | Privy integration commits: `6a1d4dc`, `c4b7ff2`, `992ac82`, `177e2a0`, `509fe6a` |

## Key files

| File | Purpose |
|------|---------|
| `frontend/context/BackstopContext.tsx` | Privy login, embedded wallet state, scoped signer creation, approve/ship/policy-test functions, `addPolicyLog` |
| `frontend/app/overview/page.tsx` | UI shell: login button, scoped signer status, approve/ship/policy-test buttons, PolicyChecklist rendering |
| `frontend/app/providers.tsx` | `PrivyProvider` config with Sepolia chain, embedded wallet creation on login |
| `contracts/test/Phase1Spikes.t.sol` | Privy spike tests: policy allow/block addresses |

## Flow walkthrough

1. **Login with Privy** → embedded wallet created (`BackstopContext.tsx:176` — `usePrivy()` hook)
2. **Add Scoped Signer** → `addSigners({ address, signers: [{ signerId, policyIds }] })` (`BackstopContext.tsx:293-321`)
3. **Approve Aqua** → ERC-20 `approve()` sent through scoped signer (`BackstopContext.tsx:386-400`)
4. **Ship Strategy** → `aqua.ship()` calldata encoded and sent through scoped signer (`BackstopContext.tsx:401-445`)
5. **Policy Tests**:
   - **Within-policy tx**: zero-value USDC transfer to self succeeds (`BackstopContext.tsx:446-455`)
   - **Outside-policy tx**: transfer to disallowed address blocked client-side (`BackstopContext.tsx:456-460`)

## Policy enforcement

| Layer | Mechanism | Where |
|-------|-----------|-------|
| Client-side allowlist | `enforceClientAllowlist` checks `to` against `[AQUA_REGISTRY, BACKSTOP_APP_ADDRESS, ALLOWED_ADDRESS, USDC_ADDRESS]` | `BackstopContext.tsx:358-360` |
| Privy server-side policy | Scoped signer with `policyIds` — enforced by Privy Wallet API | `BackstopContext.tsx:137-143` (interface), `BackstopContext.tsx:293-321` (implementation) |
| Policy Log UI | Every accept/reject event timestamped and displayed | `BackstopContext.tsx:202` (`addPolicyLog`), rendered in `overview/page.tsx:99` (`PolicyChecklist` component) |

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
