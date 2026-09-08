'use client';

import {useBackstop} from '@/hooks/useBackstop';
import {Header, Navigation, StrategyCard, SponsorFooter} from '@/components';

export default function StrategyPage() {
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
        {label: 'Strategy', href: '/strategy', active: true},
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
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Connect to manage your strategy</h2>
              <button
                onClick={backstop.login}
                className="mt-6 rounded-full bg-zinc-900 dark:bg-zinc-100 px-6 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <StrategyCard strategy={backstop.strategy} />

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Maker Onboarding</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  Fund your wallet, approve Aqua, and ship your strategy to activate backstop protection.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={backstop.fundWallet}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Fund Wallet
                  </button>
                  <button
                    onClick={backstop.refreshBalances}
                    disabled={backstop.balancesLoading}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                  >
                    Refresh Balances
                  </button>
                  <button
                    onClick={backstop.approveAqua}
                    disabled={!backstop.signerAdded}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                  >
                    Approve Aqua
                  </button>
                  <button
                    onClick={backstop.shipStrategy}
                    disabled={!backstop.signerAdded}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                  >
                    Ship Strategy
                  </button>
                </div>
              </div>

              <SponsorFooter />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
