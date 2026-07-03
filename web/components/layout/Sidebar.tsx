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

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{
    className?: string;
    'aria-hidden'?: React.AriaAttributes['aria-hidden'];
  }>;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/log', label: 'Log', icon: Plus },
  { href: '/trends', label: 'Trends', icon: TrendingUp },
  { href: '/history', label: 'History', icon: History },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname() ?? '';

  return (
    <aside className="hidden md:flex flex-col w-60 h-dvh sticky top-0 z-10 bg-bg border-r border-border px-md py-lg">
      <div className="px-sm mb-xl">
        <h3 className="text-h3 font-semibold text-text">Smoke Ledger</h3>
        <p className="text-caption uppercase text-text-muted mt-1 tracking-wide">
          India · INR
        </p>
      </div>

      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-sm px-md py-sm rounded-md text-body transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active
                  ? 'bg-accent-soft text-accent'
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
