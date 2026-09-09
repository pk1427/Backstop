'use client';

type Status = 'active' | 'monitoring' | 'setup' | 'action-required' | 'paused';

interface StatusBadgeProps {
  status: Status;
  label?: string;
}

const statusConfig: Record<Status, { dot: string; text: string; bg: string; border: string; textColor: string }> = {
  active: {
    dot: 'bg-success',
    text: 'ACTIVE',
    bg: 'bg-success/10',
    border: 'border-success/30',
    textColor: 'text-success',
  },
  monitoring: {
    dot: 'bg-accent',
    text: 'MONITORING',
    bg: 'bg-accent/10',
    border: 'border-accent/30',
    textColor: 'text-accent',
  },
  setup: {
    dot: 'bg-text-secondary',
    text: 'SETUP REQUIRED',
    bg: 'bg-surface-raised',
    border: 'border-border',
    textColor: 'text-text-secondary',
  },
  'action-required': {
    dot: 'bg-warning',
    text: 'ACTION REQUIRED',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    textColor: 'text-warning',
  },
  paused: {
    dot: 'bg-danger',
    text: 'PAUSED',
    bg: 'bg-danger/10',
    border: 'border-danger/30',
    textColor: 'text-danger',
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
