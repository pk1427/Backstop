'use client';

import {useBackstop} from '@/hooks/useBackstop';
import {Header, CapitalCard, StrategyCard, OpportunityCard, PolicyChecklist, SponsorFooter} from '@/components';

export default function OverviewPage() {
  const backstop = useBackstop();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        systemStatus={backstop.systemStatus}
        statusLabel={backstop.statusLabel}
        walletAddress={backstop.embeddedWallet?.address}
        network={`Sepolia (${process.env.NEXT_PUBLIC_CHAIN_ID || '11155111'})`}
        navItems={[
          {label: 'Overview', href: '/overview', active: true},
          {label: 'Strategy', href: '/strategy'},
          {label: 'Opportunities', href: '/opportunities'},
          {label: 'Activity', href: '/activity'},
        ]}
        onLogout={backstop.logout}
      />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {!backstop.authenticated ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-accent-contrast">B</span>
              </div>
              <h2 className="text-xl font-semibold text-text-primary">Confidential Liquidation Backstop</h2>
              <p className="mt-2 max-w-md text-sm text-text-secondary">
                Self-custodial capital, privately priced execution, policy-bounded automation.
                Connect your wallet to activate your backstop strategy.
              </p>
              <button
                onClick={backstop.login}
                className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-contrast hover:bg-accent-muted transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {backstop.systemStatus !== 'active' && (
                <div className={`rounded-xl border p-4 ${
                  backstop.systemStatus === 'action-required' ? 'border-warning/30 bg-warning/10' :
                  'border-border bg-surface-raised'
                }`}>
                  <div className="flex items-center gap-3">
                    {backstop.systemStatus === 'action-required' && (
                      <svg className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    {backstop.systemStatus === 'setup' && (
                      <svg className="h-5 w-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    )}
                    <div>
                      <p className="text-sm font-medium text-text-primary">{backstop.statusLabel}</p>
                      {!backstop.signerAdded && (
                        <p className="text-xs text-text-secondary mt-0.5">
                          Add the Backstop scoped signer to continue.
                          {!process.env.NEXT_PUBLIC_PRIVY_AUTH_KEY_ID && ' Configure NEXT_PUBLIC_PRIVY_AUTH_KEY_ID in your environment.'}
                          {!process.env.NEXT_PUBLIC_PRIVY_POLICY_ID && ' Configure NEXT_PUBLIC_PRIVY_POLICY_ID in your environment.'}
                        </p>
                      )}
                      {!backstop.strategy && backstop.signerAdded && (
                        <p className="text-xs text-text-secondary mt-0.5">Fund your wallet and ship a strategy to activate backstop protection.</p>
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

                <section className="rounded-xl border border-border bg-surface p-6">
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Execution</p>
                  {backstop.executionResult ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-success">Execution complete</p>
                        {backstop.executionResult.simulated && (
                          <span className="inline-flex items-center rounded-full border border-border bg-surface-raised px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">SIMULATED</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-text-secondary">USDC Deployed</p>
                          <p className="font-medium text-text-primary tabular-nums">{backstop.executionResult.usdcDeployed}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-secondary">WETH Pushed</p>
                          <p className="font-medium text-text-primary tabular-nums">{backstop.executionResult.wethPushed}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-secondary">Maker USDC</p>
                          <p className="font-mono text-text-primary tabular-nums">{backstop.executionResult.makerUsdcBefore} → {backstop.executionResult.makerUsdcAfter}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-secondary">Maker WETH</p>
                          <p className="font-mono text-text-primary tabular-nums">{backstop.executionResult.makerWethBefore} → {backstop.executionResult.makerWethAfter}</p>
                        </div>
                      </div>
                      <p className="text-xs font-mono text-text-secondary break-all">Tx: {backstop.executionResult.txHash}</p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-sm text-text-secondary">No execution yet.</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={backstop.simulateSwap}
                          disabled={!backstop.strategy || !backstop.latestQuote || backstop.simulating}
                          className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast hover:bg-accent-muted disabled:opacity-50 transition-colors"
                        >
                          {backstop.simulating ? 'Executing...' : 'Execute Backstop'}
                        </button>
                        <span className="inline-flex items-center rounded-full border border-border bg-surface-raised px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">SIMULATED</span>
                      </div>
                      {!backstop.strategy && <p className="mt-2 text-xs text-text-secondary">Ship a strategy first.</p>}
                      {backstop.strategy && !backstop.latestQuote && <p className="mt-2 text-xs text-text-secondary">Waiting for quote...</p>}
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
