'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Plus,
  ScrollText,
  Settings,
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
  { href: '/history', label: 'History', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav
      aria-label="Primary"
      className="bg-card border-t border-border h-16 flex items-stretch"
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              active ? 'text-accent' : 'text-text-muted hover:text-text',
            )}
          >
            <Icon className="w-5 h-5" aria-hidden />
            <span className="text-caption font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomNav;
