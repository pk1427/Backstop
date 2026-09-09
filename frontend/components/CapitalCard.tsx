'use client';

interface CapitalCardProps {
  ethBalance: string | null;
  usdcBalance: string | null;
  walletAddress: string | undefined;
  network: string;
  lastUpdated: string | null;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function CapitalCard({
  ethBalance,
  usdcBalance,
  walletAddress,
  network,
  lastUpdated,
  onRefresh,
  refreshing,
}: CapitalCardProps) {
  const usdcDisplay = usdcBalance !== null ? `$${Number(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const ethDisplay = ethBalance !== null ? `${Number(ethBalance).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ETH` : '—';

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Protected Capital</p>
          <p className="mt-2 text-3xl font-semibold text-text-primary tabular-nums">{usdcDisplay}</p>
          <p className="mt-1 text-sm text-text-secondary tabular-nums">{ethDisplay}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="inline-flex items-center rounded-full border border-border bg-surface-raised px-2 py-0.5 text-xs text-text-secondary">
            {network}
          </span>
          {lastUpdated && (
            <span className="text-xs text-text-secondary">Updated {lastUpdated}</span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-surface-raised flex items-center justify-center">
            <svg className="h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Wallet</p>
            <p className="text-sm font-mono text-text-primary">
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised disabled:opacity-50 transition-colors"
          aria-label="Refresh balances"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
