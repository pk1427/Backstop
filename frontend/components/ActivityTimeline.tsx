'use client';

interface ActivityTimelineProps {
  events: { time: string; label: string; status: 'success' | 'error' | 'policy' | 'info'; description?: string; txHash?: string; simulated?: boolean }[];
}

export default function ActivityTimeline({ events }: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-[#243a5a] bg-[#071023]/80 p-6">
        <p className="text-xs font-medium uppercase tracking-[.14em] text-slate-500">Recent activity</p>
        <p className="mt-2 text-sm text-slate-400">Your confirmed approvals and strategies will appear here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#243a5a] bg-[#071023]/80 p-4 sm:p-5">
      <p className="px-1 text-xs font-medium uppercase tracking-[.14em] text-slate-500">Recent activity</p>
      <div className="mt-3 divide-y divide-[#1b2d49] rounded-xl border border-[#203654] bg-[#050d1d]">
        {events.map((event, idx) => {
          return (
            <div key={idx} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:flex-nowrap">
              <span className="w-16 shrink-0 font-mono text-xs tabular-nums text-slate-500">{event.time}</span>
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.7)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-100">{event.label}</p>
                {event.description && <p className="mt-0.5 text-xs text-slate-500">{event.description}</p>}
              </div>
              {event.txHash && <a href={`https://sepolia.etherscan.io/tx/${event.txHash}`} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-cyan-300 transition hover:text-cyan-200">Etherscan ↗</a>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
