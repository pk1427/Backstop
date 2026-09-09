'use client';

interface ActivityTimelineProps {
  events: { time: string; label: string; status: 'success' | 'error' | 'policy' | 'info'; description?: string; txHash?: string; simulated?: boolean }[];
}

const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
  success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
  error: { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/30' },
  policy: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
  info: { bg: 'bg-surface-raised', text: 'text-text-secondary', border: 'border-border' },
};

export default function ActivityTimeline({ events }: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Recent Activity</p>
        <p className="mt-2 text-sm text-text-secondary">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Recent Activity</p>
      <div className="mt-3 space-y-2">
        {events.map((event, idx) => {
          const style = statusStyles[event.status] || statusStyles.info;
          return (
            <div key={idx} className={`flex items-start justify-between rounded-lg border px-3 py-2 ${style.border} ${style.bg}`}>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary tabular-nums">{event.time}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${style.text}`}>{event.label}</p>
                    {event.simulated && (
                      <span className="inline-flex items-center rounded-full bg-warning/10 border border-warning/30 px-2 py-0.5 text-xs font-medium text-warning">SIMULATED</span>
                    )}
                  </div>
                  {event.description && <p className="text-xs text-text-secondary">{event.description}</p>}
                  {event.txHash && (
                    <p className="text-xs font-mono text-text-secondary mt-0.5 break-all">{event.txHash}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
