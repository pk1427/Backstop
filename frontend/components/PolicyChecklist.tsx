'use client';

interface PolicyChecklistProps {
  checks: { label: string; passed: boolean; detail?: string }[];
  overallPassed: boolean;
}

export default function PolicyChecklist({ checks, overallPassed }: PolicyChecklistProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Execution Check</p>

      <div className="mt-3 space-y-2">
        {checks.map((check, idx) => (
          <div key={idx} className="flex items-center justify-between rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
            <div className="flex items-center gap-2">
              {check.passed ? (
                <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className={`text-sm ${check.passed ? 'text-zinc-700 dark:text-zinc-200' : 'text-red-600 dark:text-red-400'}`}>{check.label}</span>
            </div>
            {check.detail && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{check.detail}</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3">
        {overallPassed ? (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">READY TO EXECUTE</p>
        ) : (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">EXECUTION BLOCKED</p>
        )}
      </div>
    </div>
  );
}
