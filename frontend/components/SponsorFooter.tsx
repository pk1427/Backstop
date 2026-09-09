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
    <footer className={`border-t border-border bg-surface-raised/50 ${className}`}>
      <div className="mx-auto max-w-6xl px-6 py-6">
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">Powered by</p>
        <div className="flex flex-wrap gap-4">
          {sponsors.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-surface-raised flex items-center justify-center">
                <span className="text-[10px] font-bold text-text-secondary">{s.name[0]}</span>
              </div>
              <div>
                <p className="text-xs font-medium text-text-primary">{s.name}</p>
                <p className="text-[11px] text-text-secondary">{s.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
