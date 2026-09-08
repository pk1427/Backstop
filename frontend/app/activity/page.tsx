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
      else if (log.message.includes('Swap executed')) label = 'LIQUIDATION EXECUTION';
      else if (log.message.includes('Transaction succeeded')) label = 'TRANSACTION';
      else if (log.message.includes('blocked') || log.message.includes('Blocked')) label = 'ACCESS CONTROL';
      else if (log.message.includes('error') || log.message.includes('Error')) label = 'ERROR';
      else label = log.message.slice(0, 30).toUpperCase();
      return {time: log.time, label, status: log.type, description: log.message};
    }),
  ];

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
        {label: 'Opportunities', href: '/opportunities', active: false},
        {label: 'Activity', href: '/activity', active: true},
      ]} />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          {!backstop.authenticated ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-12 w-12 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-white dark:text-zinc-900">B</span>
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Connect to view activity</h2>
              <button
                onClick={backstop.login}
                className="mt-6 rounded-full bg-zinc-900 dark:bg-zinc-100 px-6 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <ActivityTimeline events={activityEvents} />

              <details className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <summary className="cursor-pointer select-none px-6 py-4 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-zinc-100">
                  Wallet & Policy
                </summary>
                <div className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Scoped Signer</p>
                        <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{backstop.signerAdded ? 'Added' : 'Not added'}</p>
                        {!backstop.signerAdded && process.env.NEXT_PUBLIC_PRIVY_AUTH_KEY_ID && process.env.NEXT_PUBLIC_PRIVY_POLICY_ID && (
                          <button
                            onClick={backstop.addSigner}
                            disabled={backstop.addingSigner}
                            className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                          >
                            {backstop.addingSigner ? 'Adding...' : 'Add Scoped Signer'}
                          </button>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Auth Key ID</p>
                        <p className="mt-1 text-xs font-mono text-zinc-700 dark:text-zinc-300">{process.env.NEXT_PUBLIC_PRIVY_AUTH_KEY_ID ? `${process.env.NEXT_PUBLIC_PRIVY_AUTH_KEY_ID.slice(0, 12)}...` : 'Not configured'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Policy ID</p>
                        <p className="mt-1 text-xs font-mono text-zinc-700 dark:text-zinc-300">{process.env.NEXT_PUBLIC_PRIVY_POLICY_ID ? `${process.env.NEXT_PUBLIC_PRIVY_POLICY_ID.slice(0, 12)}...` : 'Not configured'}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Policy Tests</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={backstop.testWithinPolicyTx}
                            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                          >
                            Test Within-Policy Tx
                          </button>
                          <button
                            onClick={backstop.testOutsidePolicyTx}
                            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                          >
                            Test Disallowed Tx
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </details>

              <details className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <summary className="cursor-pointer select-none px-6 py-4 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-zinc-100">
                  Advanced: Failure Mode Lab
                </summary>
                <div className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                    Each button simulates a contract-level revert. These are demo controls, not production paths.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={backstop.triggerExpiredQuote} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                      <span className="block font-semibold">Expired Quote</span>
                      <span className="block mt-0.5 text-zinc-500 dark:text-zinc-400">Quote expiry in the past</span>
                    </button>
                    <button onClick={backstop.triggerSizeExceeded} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                      <span className="block font-semibold">Size exceeds maxTrade</span>
                      <span className="block mt-0.5 text-zinc-500 dark:text-zinc-400">Quote size above strategy limit</span>
                    </button>
                    <button onClick={backstop.triggerPriceBelowMin} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                      <span className="block font-semibold">Price below min discount</span>
                      <span className="block mt-0.5 text-zinc-500 dark:text-zinc-400">Price outside allowed lower bound</span>
                    </button>
                    <button onClick={backstop.triggerPriceAboveMax} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                      <span className="block font-semibold">Price above max discount</span>
                      <span className="block mt-0.5 text-zinc-500 dark:text-zinc-400">Price outside allowed upper bound</span>
                    </button>
                    <button onClick={backstop.triggerUnauthorizedWrite} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                      <span className="block font-semibold">Unauthorized registry write</span>
                      <span className="block mt-0.5 text-zinc-500 dark:text-zinc-400">Non-forwarder attempts onReport</span>
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
