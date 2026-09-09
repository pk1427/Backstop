'use client';

import {useBackstop} from '@/hooks/useBackstop';
import {Header, Navigation, CapitalCard, StrategyCard, OpportunityCard, PolicyChecklist, SponsorFooter} from '@/components';

export default function OverviewPage() {
  const backstop = useBackstop();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <Header
        systemStatus={backstop.systemStatus}
        statusLabel={backstop.statusLabel}
        walletAddress={backstop.embeddedWallet?.address}
        network={`Sepolia (${process.env.NEXT_PUBLIC_CHAIN_ID || '11155111'})`}
        onLogout={backstop.logout}
      />
      <Navigation items={[
        {label: 'Overview', href: '/overview', active: true},
        {label: 'Strategy', href: '/strategy', active: false},
        {label: 'Opportunities', href: '/opportunities', active: false},
        {label: 'Activity', href: '/activity', active: false},
      ]} />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
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
            <div className="flex flex-col gap-6">
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CapitalCard
                  ethBalance={backstop.ethBalance}
                  usdcBalance={backstop.usdcBalance}
                  walletAddress={backstop.embeddedWallet?.address}
                  network={`Sepolia (${process.env.NEXT_PUBLIC_CHAIN_ID || '11155111'})`}
                  lastUpdated={backstop.lastUpdated}
                  onRefresh={backstop.refreshBalances}
                  refreshing={backstop.balancesLoading}
                />

                <StrategyCard strategy={backstop.strategy} />
              </div>

              <OpportunityCard
                quote={backstop.latestQuote}
                loading={backstop.quoteLoading}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PolicyChecklist checks={backstop.policyChecks} overallPassed={backstop.policyOverallPassed} />

                <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Execution</p>
                  {backstop.executionResult ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Execution complete</p>
                        {backstop.executionResult.simulated && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-800 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-100 border border-amber-300 dark:border-amber-500">SIMULATED</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">USDC Deployed</p>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">{backstop.executionResult.usdcDeployed}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">WETH Pushed</p>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">{backstop.executionResult.wethPushed}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Maker USDC</p>
                          <p className="font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">{backstop.executionResult.makerUsdcBefore} → {backstop.executionResult.makerUsdcAfter}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Maker WETH</p>
                          <p className="font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">{backstop.executionResult.makerWethBefore} → {backstop.executionResult.makerWethAfter}</p>
                        </div>
                      </div>
                      <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 break-all">Tx: {backstop.executionResult.txHash}</p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">No execution yet.</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={backstop.simulateSwap}
                          disabled={!backstop.strategy || !backstop.latestQuote || backstop.simulating}
                          className="flex-1 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                        >
                          {backstop.simulating ? 'Executing...' : 'Execute Backstop'}
                        </button>
                        <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-800 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-100 border border-amber-300 dark:border-amber-500">SIMULATED</span>
                      </div>
                      {!backstop.strategy && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Ship a strategy first.</p>}
                      {backstop.strategy && !backstop.latestQuote && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Waiting for quote...</p>}
                    </div>
                  )}
                </section>
              </div>

              <SponsorFooter />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
