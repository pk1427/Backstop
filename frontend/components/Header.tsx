'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import StatusBadge from './StatusBadge';

interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

interface HeaderProps {
  variant?: 'landing' | 'app';
  systemStatus?: 'active' | 'monitoring' | 'setup' | 'action-required' | 'paused';
  statusLabel?: string;
  walletAddress?: string;
  network?: string;
  navItems?: NavItem[];
  onLogout?: () => void;
}

const appNavItems = [
  {label: 'Overview', href: '/overview'},
  {label: 'Strategy', href: '/strategy'},
  {label: 'Opportunities', href: '/opportunities'},
  {label: 'Activity', href: '/activity'},
];

export default function Header({
  variant = 'app',
  systemStatus,
  statusLabel,
  walletAddress,
  network,
  navItems = appNavItems,
  onLogout,
}: HeaderProps) {
  const isLanding = variant === 'landing';
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6">
        <Link href={isLanding ? '/' : '/overview'} className="flex min-w-0 items-center gap-3" aria-label="Backstop home">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent">
            <span className="text-sm font-bold text-accent-contrast">B</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">Backstop</p>
            <p className="hidden text-xs text-text-secondary sm:block">Confidential Liquidation Backstop</p>
          </div>
        </Link>

        {isLanding ? (
          <Link
            href="/overview"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Launch App
          </Link>
        ) : (
          <>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
              {navItems.map((item) => {
                const active = item.active ?? pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      active ? 'bg-surface-raised text-text-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              {network && <span className="hidden rounded-full border border-border bg-surface-raised px-2.5 py-1 text-xs text-text-secondary lg:inline-flex">{network}</span>}
              {walletAddress && (
                <span className="hidden rounded-md bg-surface-raised px-2.5 py-1 text-xs font-mono text-text-secondary sm:inline-flex" title={walletAddress}>
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              )}
              {systemStatus && <StatusBadge status={systemStatus} label={statusLabel} />}
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Disconnect
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {!isLanding && (
        <nav className="border-t border-border md:hidden" aria-label="Main mobile">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2">
            {navItems.map((item) => {
              const active = item.active ?? false;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
                    active ? 'bg-surface-raised text-text-primary' : 'text-text-secondary'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
