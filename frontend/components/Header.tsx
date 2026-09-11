'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

interface HeaderProps {
  systemStatus: 'active' | 'monitoring' | 'setup' | 'action-required' | 'paused';
  statusLabel?: string;
  walletAddress?: string;
  network: string;
  onLogout: () => void;
}

export default function Header({ systemStatus, statusLabel, walletAddress, network, onLogout }: HeaderProps) {
  void systemStatus;
  void statusLabel;
  const pathname = usePathname();
  const items = [
    {label: 'Dashboard', href: '/overview'},
    {label: 'Strategy', href: '/strategy'},
    {label: 'Liquidations', href: '/opportunities'},
    {label: 'Activity', href: '/activity'},
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#030816]/85 px-4 py-4 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex h-[76px] max-w-[1720px] items-center rounded-[24px] border border-[#253653] bg-[#050914]/95 px-6 shadow-[0_0_0_1px_rgba(255,255,255,.025),0_16px_45px_rgba(0,0,0,.32)] sm:px-7">
        <Link href="/overview" className="flex shrink-0 items-center gap-3">
          <span className="grid h-9 w-9 place-items-center text-xl text-violet-400 [text-shadow:0_0_16px_rgba(139,92,246,.8)]">✦</span>
          <span className="text-xl font-bold tracking-[.23em] text-white">BACKSTOP</span>
        </Link>
        <nav className="mx-auto hidden items-center gap-10 lg:flex" aria-label="Main navigation">
          {items.map((item) => {
            const active = pathname === item.href || (item.href === '/opportunities' && pathname.startsWith('/opportunities/'));
            return <Link key={item.href} href={item.href} className={`text-sm font-semibold uppercase tracking-[.12em] transition-colors ${active ? 'text-cyan-300' : 'text-slate-400 hover:text-white'}`}>{item.label}</Link>;
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {walletAddress ? <button onClick={onLogout} title={`${network} · ${walletAddress}`} className="rounded-full border border-cyan-400/55 bg-cyan-400/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-400/15">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</button> : <Link href="/" className="rounded-full border border-cyan-400/55 bg-cyan-400/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-400/15">Launch App</Link>}
        </div>
      </div>
      <nav className="mx-auto mt-3 flex max-w-[1720px] items-center justify-around lg:hidden" aria-label="Mobile navigation">
        {items.map((item) => <Link key={item.href} href={item.href} className={`py-2 text-[10px] font-semibold uppercase tracking-[.08em] ${pathname === item.href ? 'text-cyan-300' : 'text-slate-500'}`}>{item.label}</Link>)}
      </nav>
    </header>
  );
}
