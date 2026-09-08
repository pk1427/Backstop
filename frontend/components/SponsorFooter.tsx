'use client';

interface SponsorFooterProps {
  className?: string;
}

const sponsors = [
  { name: '1inch Aqua', role: 'Capital custody & execution' },
  { name: 'Chainlink CRE', role: 'Confidential quoting' },
  { name: 'Privy', role: 'Scoped authorization' },
];

export default function SponsorFooter({ className = '' }: SponsorFooterProps) {
  return (
    <footer className={`border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 ${className}`}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Powered by</p>
        <div className="flex flex-wrap gap-4">
          {sponsors.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">{s.name[0]}</span>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">{s.name}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{s.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
