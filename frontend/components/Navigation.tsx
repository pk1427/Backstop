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
    <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" aria-label="Main">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6 overflow-x-auto">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                item.active
                  ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
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
