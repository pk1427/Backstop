'use client';

interface StrategyCardProps {
  strategy: {
    maker: string;
    tokenIn: string;
    tokenOut: string;
    maxTrade: string;
    minDiscountBps: string;
    maxDiscountBps: string;
    expiry: string;
    salt: string;
  } | null;
  onManage?: () => void;
}

function toPercent(bps: string) {
  const val = Number(bps);
  if (Number.isNaN(val)) return '—';
  return `${(val / 100).toFixed(2)}%`;
}

function strategyExpiry(value: string) {
  if (/^\d+$/.test(value)) return new Date(Number(value) * 1000).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'});
  return value;
}

export default function StrategyCard({ strategy, onManage }: StrategyCardProps) {
  if (!strategy) {
    return (
      <div className="protocol-card rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Active Strategy</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No active strategy</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Configure and ship your first Backstop strategy.</p>
          </div>
        </div>
      </div>
    );
  }

  const controlled = strategy.tokenOut.toLowerCase() === '0xfd080b70baefd6bb19906c107a7240c4e5c2dcca';
  const capitalAsset = controlled ? 'btUSDC' : 'USDC';
  const collateralAsset = controlled ? 'btWETH' : 'WETH';

  return (
    <div className="protocol-card rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Active Strategy</p>
          <p className="mt-2 text-sm text-zinc-900 dark:text-zinc-100 font-medium">{capitalAsset} → {collateralAsset} Backstop</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          ACTIVE
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Max Trade</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">{Number(strategy.maxTrade).toLocaleString('en-US')} {capitalAsset}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Discount Range</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
            {toPercent(strategy.minDiscountBps)} – {toPercent(strategy.maxDiscountBps)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Expiry</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">{strategyExpiry(strategy.expiry)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Token Pair</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">{capitalAsset} / {collateralAsset}</p>
        </div>
      </div>

      {onManage && (
        <div className="mt-4">
          <button
            onClick={onManage}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            Manage Strategy
          </button>
        </div>
      )}
    </div>
  );
}
