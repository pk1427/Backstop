'use client';

interface ActivityTimelineProps {
  events: { time: string; label: string; status: 'success' | 'error' | 'policy' | 'info'; description?: string; txHash?: string; simulated?: boolean }[];
}

const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
  success: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  error: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
  policy: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  info: { bg: 'bg-zinc-50 dark:bg-zinc-900', text: 'text-zinc-700 dark:text-zinc-300', border: 'border-zinc-200 dark:border-zinc-700' },
};

export default function ActivityTimeline({ events }: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Recent Activity</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Recent Activity</p>
      <div className="mt-3 space-y-2">
        {events.map((event, idx) => {
          const style = statusStyles[event.status] || statusStyles.info;
          return (
            <div key={idx} className={`flex items-start justify-between rounded-lg border px-3 py-2 ${style.border} ${style.bg}`}>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{event.time}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${style.text}`}>{event.label}</p>
                    {event.simulated && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">SIMULATED</span>
                    )}
                  </div>
                  {event.description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{event.description}</p>}
                  {event.txHash && (
                    <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5 break-all">{event.txHash}</p>
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
