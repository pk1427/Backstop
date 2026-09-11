'use client';

interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

interface NavigationProps {
  items: NavItem[];
}

export default function Navigation({ items }: NavigationProps) {
  // Navigation is rendered in Header so desktop uses one protocol-style bar.
  void items;
  return null;
}
