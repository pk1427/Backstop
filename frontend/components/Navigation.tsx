'use client';

import Link from 'next/link';

interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

interface NavigationProps {
  items: NavItem[];
}

export default function Navigation({ items }: NavigationProps) {
  return (
    <nav className="border-b border-border bg-surface" aria-label="Main">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex gap-6 overflow-x-auto">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                item.active
                  ? 'border-accent text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
