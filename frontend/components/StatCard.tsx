'use client';

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon?: React.ReactNode;
}

export default function StatCard({ label, value, subtext, icon }: StatCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
      {subtext && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtext}</p>}
    </div>
  );
}
