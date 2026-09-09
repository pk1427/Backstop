'use client';

interface OpportunityCardProps {
  quote: {
    quoteId: string;
    price: string;
    size: string;
    expiry: string;
    execute: boolean;
    healthFactor: number;
    collateralUsd: number;
    debtUsd: number;
    liquidationSizeUsd: number;
    executionPriceUsd: number;
    discountBps: number;
    simulated: boolean;
    source: 'demo' | 'live';
  } | null;
  loading?: boolean;
}

function formatUsd(value: number) {
  if (Number.isNaN(value)) return '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function healthStatus(hf: number): { label: string; color: string } {
  if (hf >= 1.05) return { label: 'Healthy', color: 'text-emerald-600 dark:text-emerald-400' };
  if (hf >= 1.0) return { label: 'Approaching liquidation', color: 'text-amber-600 dark:text-amber-400' };
  return { label: 'Liquidatable', color: 'text-red-600 dark:text-red-400' };
}

export default function OpportunityCard({ quote, loading }: OpportunityCardProps) {
  const isLive = quote?.source === 'live';
  const healthFactor = quote?.healthFactor ?? 0;
  const collateral = quote?.collateralUsd ?? 0;
  const debt = quote?.debtUsd ?? 0;
  const liquidationSizeUsd = quote?.liquidationSizeUsd ?? 0;
  const executionPriceUsd = quote?.executionPriceUsd ?? 0;
  const discountBps = quote?.discountBps ?? 0;
  const status = healthStatus(healthFactor);
  const quoteSizeUsd = formatUsd(liquidationSizeUsd);
  const discountPct = `${(discountBps / 100).toFixed(2)}%`;
  const expiresIn = quote ? Math.max(0, Number(quote.expiry) - Math.floor(Date.now() / 1000)) : 0;
  const expiresInMin = Math.floor(expiresIn / 60);
  const expiresInSec = expiresIn % 60;

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
          <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            {isLive ? 'Live Aave Opportunity' : 'Simulated Opportunity'}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Borrower position eligible for liquidation</p>
        </div>
        {!isLive && (
          <span className="inline-flex items-center rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            DEMO DATA
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Health Factor</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{healthFactor.toFixed(2)}</span>
            <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Liquidation Size</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{quoteSizeUsd}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Collateral</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{formatUsd(collateral)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Debt</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{formatUsd(debt)}</p>
        </div>
      </div>

      {quote && (
        <div className="mt-4 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
            {isLive ? 'Live Execution Quote' : 'Private Execution Quote'}
          </p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Execution Price</p>
              <p className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">{formatUsd(executionPriceUsd)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Discount</p>
              <p className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">{discountPct}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Expires in</p>
              <p className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                {expiresInMin > 0 ? `${expiresInMin}m ` : ''}{expiresInSec}s
              </p>
            </div>
          </div>
          {!isLive && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">SIMULATED CRE QUOTE</p>
          )}
        </div>
      )}
    </div>
  );
}
