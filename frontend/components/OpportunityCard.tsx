'use client';

import {useEffect, useState} from 'react';

interface OpportunityCardProps {
  quote: {
    quoteId: string;
    price: string;
    size: string;
    minCollateralOut: string;
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
  const [now, setNow] = useState(0);

  useEffect(() => {
    const updateNow = () => setNow(Math.floor(Date.now() / 1000));
    updateNow();
    const interval = window.setInterval(updateNow, 1000);
    return () => window.clearInterval(interval);
  }, []);

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
  const minCollateralWeth = quote ? (Number(BigInt(quote.minCollateralOut)) / 1e18).toFixed(4) : '0.0000';
  const expiresIn = quote ? Math.max(0, Number(quote.expiry) - now) : 0;
  const expiresInMin = Math.floor(expiresIn / 60);
  const expiresInSec = expiresIn % 60;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-surface-raised rounded w-1/3" />
          <div className="h-10 bg-surface-raised rounded w-1/2" />
          <div className="h-4 bg-surface-raised rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            {isLive ? 'Live Aave Opportunity' : 'Simulated Opportunity'}
          </p>
          <p className="mt-1 text-sm text-text-secondary">Borrower position eligible for liquidation</p>
        </div>
        {!isLive && (
          <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
            DEMO DATA
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-text-secondary">Health Factor</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-text-primary tabular-nums">{healthFactor.toFixed(2)}</span>
            <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Liquidation Size</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary tabular-nums">{quoteSizeUsd}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Collateral</p>
          <p className="mt-1 text-sm font-medium text-text-primary">{formatUsd(collateral)}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Debt</p>
          <p className="mt-1 text-sm font-medium text-text-primary">{formatUsd(debt)}</p>
        </div>
      </div>

      {quote && (
        <div className="mt-4 rounded-lg border border-border bg-surface-raised p-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
            {isLive ? 'Live Execution Quote' : 'Private Execution Quote'}
          </p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-secondary">Execution Price</p>
              <p className="mt-0.5 font-medium text-text-primary tabular-nums">{formatUsd(executionPriceUsd)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Discount</p>
              <p className="mt-0.5 font-medium text-text-primary tabular-nums">{discountPct}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Minimum Collateral</p>
              <p className="mt-0.5 font-medium text-text-primary tabular-nums">{minCollateralWeth} WETH</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Expires in</p>
              <p className="mt-0.5 font-medium text-text-primary tabular-nums">
                {expiresInMin > 0 ? `${expiresInMin}m ` : ''}{expiresInSec}s
              </p>
            </div>
          </div>
          {!isLive && (
            <p className="mt-2 text-xs font-semibold text-warning">SIMULATED CRE QUOTE</p>
          )}
        </div>
      )}
    </div>
  );
}
