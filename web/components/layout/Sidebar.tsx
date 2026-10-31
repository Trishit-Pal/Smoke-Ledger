'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  History,
  LayoutDashboard,
  Plus,
  Settings,
  Target,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@web/components/ui/cn';
import { isNavActive } from '@web/lib/nav';

interface NavItem {
  href: string;
  /** Route prefixes that light this item; defaults to [href]. */
  match?: readonly string[];
  label: string;
  icon: React.ComponentType<{
    className?: string;
    'aria-hidden'?: React.AriaAttributes['aria-hidden'];
  }>;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trends', label: 'Trends', icon: TrendingUp },
  { href: '/history', label: 'Ledger', icon: History, match: ['/history', '/log'] },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname() ?? '';

  return (
    <aside className="hidden md:flex flex-col w-60 h-dvh sticky top-0 z-10 bg-bg border-r border-border px-md py-lg">
      <div className="px-sm mb-xl">
        <p className="text-h3 font-semibold text-text">Smoke Ledger</p>
        <p className="text-caption uppercase text-text-muted mt-1 tracking-wide">
          India · INR
        </p>
      </div>

      <Link
        href="/log/new"
        className="mb-lg flex min-h-11 items-center justify-center gap-sm rounded-md bg-text px-md text-body font-medium text-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <Plus className="h-4 w-4" aria-hidden />
        New entry
      </Link>

      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active = isNavActive(pathname, match ?? [href]);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-sm px-md py-sm rounded-md text-body transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active
                  ? 'bg-accent-soft text-accent-ink'
                  : 'text-text-muted hover:bg-card hover:text-text',
              )}
            >
              <Icon className="w-5 h-5" aria-hidden />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
