'use client';

import {useBackstop} from '@/hooks/useBackstop';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Header, Navigation, StrategyCard, OpportunityCard, StatCard} from '@/components';

export default function OverviewPage() {
  const backstop = useBackstop();
  const router = useRouter();

  return (
    <div className="protocol-surface flex min-h-screen flex-col bg-[#030816]">
      <Header
        systemStatus={backstop.systemStatus}
        statusLabel={backstop.statusLabel}
        walletAddress={backstop.embeddedWallet?.address}
        network={`Sepolia (${process.env.NEXT_PUBLIC_CHAIN_ID || '11155111'})`}
        onLogout={backstop.logout}
      />
      <Navigation items={[
        {label: 'Dashboard', href: '/overview', active: true},
        {label: 'Strategy', href: '/strategy', active: false},
        {label: 'Liquidations', href: '/opportunities', active: false},
        {label: 'Activity', href: '/activity', active: false},
      ]} />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          {!backstop.authenticated ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-12 w-12 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-white dark:text-zinc-900">B</span>
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Confidential Liquidation Backstop</h2>
              <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                Self-custodial capital, privately priced execution, policy-bounded automation.
                Connect your wallet to activate your backstop strategy.
              </p>
              <button
                onClick={backstop.login}
                className="mt-6 rounded-full bg-zinc-900 dark:bg-zinc-100 px-6 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold tracking-[.16em] text-cyan-300">CAPITAL MODE</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Your authorized capital</h2><p className="mt-2 text-sm text-zinc-500">A live view of the limits protecting your self-custodied USDC.</p></div><Link href="/strategy" className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20">Manage strategy</Link></div>
              <div className="grid divide-y divide-[#233552] rounded-2xl border border-[#233552] bg-[#070e20]/80 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4"><StatCard label="Wallet USDC" value={backstop.usdcBalance ? `$${Number(backstop.usdcBalance).toLocaleString()}` : '—'} /><StatCard label="Authorized capital" value={backstop.strategy ? `$${backstop.strategy.maxTrade}` : '$0'} /><StatCard label="Strategy status" value={backstop.strategy ? 'Active' : 'Setup'} /><StatCard label="Eligible now" value={backstop.latestQuote?.healthFactor && backstop.latestQuote.healthFactor < 1 ? '1' : '0'} subtext="liquidations" /></div>
              {backstop.latestQuote?.source === 'controlled' && <p className="-mt-5 text-xs text-slate-500">Controlled-market settlements use the dedicated maker’s btUSDC, not this connected wallet’s real Sepolia USDC balance.</p>}
              {backstop.systemStatus !== 'active' && (
                <div className={`rounded-xl border p-4 ${
                  backstop.systemStatus === 'action-required' ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950' :
                  'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900'
                }`}>
                  <div className="flex items-center gap-3">
                    {backstop.systemStatus === 'action-required' && (
                      <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    {backstop.systemStatus === 'setup' && (
                      <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    )}
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{backstop.statusLabel}</p>
                      {!backstop.signerAdded && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                          Add the Backstop scoped signer to continue.
                          {!process.env.NEXT_PUBLIC_PRIVY_AUTH_KEY_ID && ' Configure NEXT_PUBLIC_PRIVY_AUTH_KEY_ID in your environment.'}
                          {!process.env.NEXT_PUBLIC_PRIVY_POLICY_ID && ' Configure NEXT_PUBLIC_PRIVY_POLICY_ID in your environment.'}
                        </p>
                      )}
                      {!backstop.strategy && backstop.signerAdded && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">Fund your wallet and ship a strategy to activate backstop protection.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <StrategyCard strategy={backstop.strategy} onManage={() => router.push('/strategy')} />

              <section><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold tracking-[.14em] text-cyan-300">LIQUIDATION MARKET</p><h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Live Aave monitoring</h3></div><Link href="/opportunities" className="text-sm font-medium text-cyan-300 hover:text-cyan-200">Open market →</Link></div>{backstop.latestQuote ? <><OpportunityCard quote={backstop.latestQuote} loading={backstop.quoteLoading} /><Link href="/opportunities/opportunity" className="mt-4 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200">Review opportunity →</Link></> : <div className="protocol-card rounded-2xl p-6"><p className="font-medium text-zinc-100">No eligible liquidations right now</p><p className="mt-2 text-sm text-slate-400">Backstop is monitoring the configured live Aave position. A quote is created only when its health factor falls below 1.</p></div>}</section>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
