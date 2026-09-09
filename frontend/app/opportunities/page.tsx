'use client';

import {useBackstop} from '@/hooks/useBackstop';
import {Header, Navigation, OpportunityCard, PolicyChecklist, SponsorFooter} from '@/components';

export default function OpportunitiesPage() {
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
        {label: 'Overview', href: '/overview', active: false},
        {label: 'Strategy', href: '/strategy', active: false},
        {label: 'Opportunities', href: '/opportunities', active: true},
        {label: 'Activity', href: '/activity', active: false},
      ]} />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          {!backstop.authenticated ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-12 w-12 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-white dark:text-zinc-900">B</span>
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Connect to view opportunities</h2>
              <button
                onClick={backstop.login}
                className="mt-6 rounded-full bg-zinc-900 dark:bg-zinc-100 px-6 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
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
                          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">SIMULATED</span>
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
                        <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">SIMULATED</span>
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
