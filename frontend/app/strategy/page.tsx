'use client';

import {useBackstop} from '@/hooks/useBackstop';
import {Header, Navigation, StrategyCard, SponsorFooter} from '@/components';

export default function StrategyPage() {
  const backstop = useBackstop();

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
        {label: 'Strategy', href: '/strategy', active: true},
        {label: 'Opportunities', href: '/opportunities', active: false},
        {label: 'Activity', href: '/activity', active: false},
      ]} />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {!backstop.authenticated ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-white">B</span>
              </div>
              <h2 className="text-xl font-semibold text-text-primary">Connect to manage your strategy</h2>
              <button
                onClick={backstop.login}
                className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-muted transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <StrategyCard strategy={backstop.strategy} />

              <div className="rounded-xl border border-border bg-surface p-6">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">Maker Onboarding</p>
                <p className="text-sm text-text-secondary mb-4">
                  Fund your wallet, approve Aqua, and ship your strategy to activate backstop protection.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={backstop.fundWallet}
                    className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
                  >
                    Fund Wallet
                  </button>
                  <button
                    onClick={backstop.refreshBalances}
                    disabled={backstop.balancesLoading}
                    className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised disabled:opacity-50 transition-colors"
                  >
                    Refresh Balances
                  </button>
                  <button
                    onClick={backstop.approveAqua}
                    disabled={!backstop.signerAdded || backstop.approving}
                    className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised disabled:opacity-50 transition-colors"
                  >
                    {backstop.approving ? 'Approving...' : 'Approve Aqua'}
                  </button>
                  <button
                    onClick={backstop.shipStrategy}
                    disabled={!backstop.signerAdded || backstop.shipping}
                    className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised disabled:opacity-50 transition-colors"
                  >
                    {backstop.shipping ? 'Shipping...' : 'Ship Strategy'}
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
