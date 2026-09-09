'use client';

import {useBackstop} from '@/hooks/useBackstop';
import {Header, Navigation, ActivityTimeline, SponsorFooter} from '@/components';

export default function ActivityPage() {
  const backstop = useBackstop();

  const activityEvents = [
    ...backstop.logs.slice().reverse().slice(0, 8).map((log) => {
      let label = 'Event';
      if (log.message.includes('Strategy shipped')) label = 'STRATEGY FUNDED';
      else if (log.message.includes('Scoped signer')) label = 'SECURITY SETUP';
      else if (log.message.includes('Swap executed')) label = backstop.executionResult?.simulated ? 'LIQUIDATION EXECUTION (SIMULATED)' : 'LIQUIDATION EXECUTION';
      else if (log.message.includes('Transaction succeeded')) label = 'TRANSACTION';
      else if (log.message.includes('blocked') || log.message.includes('Blocked')) label = 'ACCESS CONTROL';
      else if (log.message.includes('error') || log.message.includes('Error')) label = 'ERROR';
      else label = log.message.slice(0, 30).toUpperCase();
      return {time: log.time, label, status: log.type, description: log.message, simulated: backstop.executionResult?.simulated && log.message.includes('Swap executed')};
    }),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
        {label: 'Opportunities', href: '/opportunities', active: false},
        {label: 'Activity', href: '/activity', active: true},
      ]} />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {!backstop.authenticated ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-white">B</span>
              </div>
              <h2 className="text-xl font-semibold text-text-primary">Connect to view activity</h2>
              <button
                onClick={backstop.login}
                className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-muted transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <ActivityTimeline events={activityEvents} />

              <details className="rounded-xl border border-border bg-surface">
                <summary className="cursor-pointer select-none px-6 py-4 text-sm font-medium text-text-primary hover:text-text-primary transition-colors">
                  Wallet & Policy
                </summary>
                <div className="border-t border-border px-6 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-text-secondary">Scoped Signer</p>
                        <p className="mt-1 text-sm text-text-primary">{backstop.signerAdded ? 'Added' : 'Not added'}</p>
                        {!backstop.signerAdded && process.env.NEXT_PUBLIC_PRIVY_AUTH_KEY_ID && process.env.NEXT_PUBLIC_PRIVY_POLICY_ID && (
                          <button
                            onClick={backstop.addSigner}
                            disabled={backstop.addingSigner}
                            className="mt-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised disabled:opacity-50 transition-colors"
                          >
                            {backstop.addingSigner ? 'Adding...' : 'Add Scoped Signer'}
                          </button>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-secondary">Auth Key ID</p>
                        <p className="mt-1 text-xs font-mono text-text-primary">{process.env.NEXT_PUBLIC_PRIVY_AUTH_KEY_ID ? `${process.env.NEXT_PUBLIC_PRIVY_AUTH_KEY_ID.slice(0, 12)}...` : 'Not configured'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-secondary">Policy ID</p>
                        <p className="mt-1 text-xs font-mono text-text-primary">{process.env.NEXT_PUBLIC_PRIVY_POLICY_ID ? `${process.env.NEXT_PUBLIC_PRIVY_POLICY_ID.slice(0, 12)}...` : 'Not configured'}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-text-secondary">Policy Tests</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={backstop.testWithinPolicyTx}
                            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
                          >
                            Test Within-Policy Tx
                          </button>
                          <button
                            onClick={backstop.testOutsidePolicyTx}
                            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
                          >
                            Test Disallowed Tx
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </details>

              <details className="rounded-xl border border-border bg-surface">
                <summary className="cursor-pointer select-none px-6 py-4 text-sm font-medium text-text-primary hover:text-text-primary transition-colors">
                  Advanced: Failure Mode Lab
                </summary>
                <div className="border-t border-border px-6 py-4">
                  <p className="text-xs text-text-secondary mb-3">
                    Each button simulates a contract-level revert. These are demo controls, not production paths.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={backstop.triggerExpiredQuote} className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface transition-colors">
                      <span className="block font-semibold">Expired Quote</span>
                      <span className="block mt-0.5 text-text-secondary">Quote expiry in the past</span>
                    </button>
                    <button onClick={backstop.triggerSizeExceeded} className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface transition-colors">
                      <span className="block font-semibold">Size exceeds maxTrade</span>
                      <span className="block mt-0.5 text-text-secondary">Quote size above strategy limit</span>
                    </button>
                    <button onClick={backstop.triggerPriceBelowMin} className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface transition-colors">
                      <span className="block font-semibold">Price below min discount</span>
                      <span className="block mt-0.5 text-text-secondary">Price outside allowed lower bound</span>
                    </button>
                    <button onClick={backstop.triggerPriceAboveMax} className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface transition-colors">
                      <span className="block font-semibold">Price above max discount</span>
                      <span className="block mt-0.5 text-text-secondary">Price outside allowed upper bound</span>
                    </button>
                    <button onClick={backstop.triggerUnauthorizedWrite} className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface transition-colors">
                      <span className="block font-semibold">Unauthorized registry write</span>
                      <span className="block mt-0.5 text-text-secondary">Non-forwarder attempts onReport</span>
                    </button>
                  </div>
                </div>
              </details>

              <SponsorFooter />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
