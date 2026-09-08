'use client';

type Status = 'active' | 'monitoring' | 'setup' | 'action-required' | 'paused';

interface StatusBadgeProps {
  status: Status;
  label?: string;
}

const statusConfig: Record<Status, { dot: string; text: string; bg: string; border: string; textColor: string }> = {
  active: {
    dot: 'bg-emerald-500',
    text: 'ACTIVE',
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    border: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-700 dark:text-emerald-300',
  },
  monitoring: {
    dot: 'bg-blue-500',
    text: 'MONITORING',
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
  setup: {
    dot: 'bg-zinc-400',
    text: 'SETUP REQUIRED',
    bg: 'bg-zinc-50 dark:bg-zinc-900',
    border: 'border-zinc-200 dark:border-zinc-700',
    textColor: 'text-zinc-600 dark:text-zinc-400',
  },
  'action-required': {
    dot: 'bg-amber-500',
    text: 'ACTION REQUIRED',
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
  paused: {
    dot: 'bg-red-500',
    text: 'PAUSED',
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-700 dark:text-red-300',
  },
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.border} ${config.textColor}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {label || config.text}
    </span>
  );
}
