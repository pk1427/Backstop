'use client';

import {useEffect, useState} from 'react';

interface PolicyChecklistProps {
  checks: { label: string; passed: boolean; detail?: string }[];
  overallPassed: boolean;
}

export default function PolicyChecklist({ checks, overallPassed }: PolicyChecklistProps) {
  const [animatePass, setAnimatePass] = useState(false);

  useEffect(() => {
    if (overallPassed) {
      const timer = setTimeout(() => setAnimatePass(true), 50);
      return () => clearTimeout(timer);
    }
    setAnimatePass(false);
  }, [overallPassed]);

  return (
    <div className={`rounded-xl border bg-surface p-6 transition-all duration-300 ${animatePass ? 'border-accent border-l-4' : 'border-border'}`}>
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Execution Check</p>

      <div className="mt-3 space-y-2">
        {checks.map((check, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-3 py-2 transition-all duration-300"
            style={{
              transitionDelay: animatePass ? `${idx * 50}ms` : '0ms',
            }}
          >
            <div className="flex items-center gap-2">
              {check.passed ? (
                <svg className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className={`text-sm ${check.passed ? 'text-text-primary' : 'text-danger'}`}>{check.label}</span>
            </div>
            {check.detail && (
              <span className="text-xs text-text-secondary">{check.detail}</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3">
        {overallPassed ? (
          <p className="text-sm font-medium text-success">READY TO EXECUTE</p>
        ) : (
          <p className="text-sm font-medium text-danger">EXECUTION BLOCKED</p>
        )}
      </div>
    </div>
  );
}
