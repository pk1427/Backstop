'use client';

import StatusBadge from './StatusBadge';

interface HeaderProps {
  systemStatus: 'active' | 'monitoring' | 'setup' | 'action-required' | 'paused';
  statusLabel?: string;
  walletAddress?: string;
  network: string;
  onLogout: () => void;
}

export default function Header({ systemStatus, statusLabel, walletAddress, network, onLogout }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/80 dark:bg-surface/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center">
                <span className="text-xs font-bold text-white">B</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-semibold text-text-primary">Backstop</h1>
                <p className="text-xs text-text-secondary">Confidential Liquidation Backstop</p>
              </div>
            </div>
            <StatusBadge status={systemStatus} label={statusLabel} />
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center rounded-full border border-border bg-surface-raised px-2 py-0.5 text-xs text-text-secondary">
              {network}
            </span>
            {walletAddress && (
              <span className="hidden sm:inline-flex items-center rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-mono text-text-secondary">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            )}
            <button
              onClick={onLogout}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
