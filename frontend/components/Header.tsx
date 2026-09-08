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
    <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
                <span className="text-xs font-bold text-white dark:text-zinc-900">B</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Backstop</h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Confidential Liquidation Backstop</p>
              </div>
            </div>
            <StatusBadge status={systemStatus} label={statusLabel} />
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-300">
              {network}
            </span>
            {walletAddress && (
              <span className="hidden sm:inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-xs font-mono text-zinc-700 dark:text-zinc-200">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            )}
            <button
              onClick={onLogout}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
