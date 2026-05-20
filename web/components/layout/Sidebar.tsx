'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  History,
  LayoutDashboard,
  Moon,
  Plus,
  Settings,
  Sun,
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
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname() ?? '';
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const currentTheme = theme === 'system' ? resolvedTheme : theme;
  const isDark = currentTheme === 'dark';

  return (
    <aside className="hidden md:flex flex-col w-60 h-screen sticky top-0 bg-bg border-r border-border px-md py-lg">
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

      <div className="mt-auto pt-lg border-t border-border">
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-full flex items-center gap-sm px-md py-sm rounded-md text-body text-text-muted hover:bg-card hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {mounted ? (
            isDark ? (
              <Sun className="w-5 h-5" aria-hidden />
            ) : (
              <Moon className="w-5 h-5" aria-hidden />
            )
          ) : (
            <span className="w-5 h-5 inline-block" aria-hidden />
          )}
          <span>{mounted ? (isDark ? 'Light mode' : 'Dark mode') : 'Theme'}</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
