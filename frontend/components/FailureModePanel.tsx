'use client';

interface FailureModePanelProps {
  onTriggerExpired: () => void;
  onTriggerSizeExceeded: () => void;
  onTriggerPriceBelowMin: () => void;
  onTriggerPriceAboveMax: () => void;
  onTriggerUnauthorizedWrite: () => void;
}

export default function FailureModePanel({
  onTriggerExpired,
  onTriggerSizeExceeded,
  onTriggerPriceBelowMin,
  onTriggerPriceAboveMax,
  onTriggerUnauthorizedWrite,
}: FailureModePanelProps) {
  const modes = [
    { label: 'Expired Quote', desc: 'Quote expiry in the past', onClick: onTriggerExpired },
    { label: 'Size exceeds maxTrade', desc: 'Quote size above strategy limit', onClick: onTriggerSizeExceeded },
    { label: 'Price below min discount', desc: 'Price outside allowed lower bound', onClick: onTriggerPriceBelowMin },
    { label: 'Price above max discount', desc: 'Price outside allowed upper bound', onClick: onTriggerPriceAboveMax },
    { label: 'Unauthorized registry write', desc: 'Non-forwarder attempts onReport', onClick: onTriggerUnauthorizedWrite },
  ];

  return (
    <details className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <summary className="cursor-pointer select-none px-6 py-4 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-zinc-100">
        Advanced: Failure Mode Lab
      </summary>
      <div className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
          Each button simulates a contract-level revert. These are demo controls, not production paths.
        </p>
        <div className="flex flex-wrap gap-2">
          {modes.map((mode) => (
            <button
              key={mode.label}
              onClick={mode.onClick}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <span className="block font-semibold">{mode.label}</span>
              <span className="block mt-0.5 text-zinc-500 dark:text-zinc-400">{mode.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}
