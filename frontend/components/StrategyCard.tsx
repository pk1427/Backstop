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

export default function StrategyCard({ strategy, onManage }: StrategyCardProps) {
  if (!strategy) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Active Strategy</p>
            <p className="mt-2 text-sm text-text-secondary">No active strategy</p>
            <p className="mt-1 text-xs text-text-secondary">Configure and ship your first Backstop strategy.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Active Strategy</p>
          <p className="mt-2 text-sm text-text-primary font-medium">USDC → WETH Backstop</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          ACTIVE
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-text-secondary">Max Trade</p>
          <p className="mt-0.5 text-sm font-medium text-text-primary tabular-nums">${Number(strategy.maxTrade).toLocaleString('en-US')}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Discount Range</p>
          <p className="mt-0.5 text-sm font-medium text-text-primary tabular-nums">
            {toPercent(strategy.minDiscountBps)} – {toPercent(strategy.maxDiscountBps)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Expiry</p>
          <p className="mt-0.5 text-sm font-medium text-text-primary">{strategy.expiry}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Token Pair</p>
          <p className="mt-0.5 text-sm font-medium text-text-primary">USDC / WETH</p>
        </div>
      </div>

      {onManage && (
        <div className="mt-4">
          <button
            onClick={onManage}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            Manage Strategy
          </button>
        </div>
      )}
    </div>
  );
}
