'use client';

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon?: React.ReactNode;
}

export default function StatCard({ label, value, subtext, icon }: StatCardProps) {
  return (
    <div className="min-w-0 px-5 py-5 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{value}</p>
      {subtext && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtext}</p>}
    </div>
  );
}
