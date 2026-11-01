'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { setSetting } from '@/db/repositories/settings';
import { USER_THEME_SETTING_KEY } from '@web/lib/userTheme';

export type ThemeTogglePlacement = 'fixed' | 'inline' | 'floating-onboarding';

export interface ThemeToggleProps {
  placement?: ThemeTogglePlacement;
}

const PILL_WIDTH = 64;
const PILL_HEIGHT = 32;
const HIT_HEIGHT = 44; // WCAG 2.5.8 target size; the visible pill stays 32px
const THUMB_SIZE = 24;
const THUMB_INSET = 4;

export function ThemeToggle({ placement = 'fixed' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => setMounted(true), []);

  const currentTheme = theme === 'system' ? resolvedTheme : theme;
  const isDark = currentTheme !== 'light';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  // Suppress the global "fixed" toggle on onboarding routes — the rail and
  // the Done page render their own placement-aware instances.
  if (placement === 'fixed' && pathname?.startsWith('/onboarding')) {
    return null;
  }

  const wrapperClass =
    placement === 'fixed'
      ? 'theme-toggle-fixed fixed top-4 right-4 z-50 mt-[env(safe-area-inset-top)] mr-[env(safe-area-inset-right)]'
      : placement === 'floating-onboarding'
        ? 'absolute z-10'
        : '';

  const wrapperStyle: React.CSSProperties =
    placement === 'floating-onboarding'
      ? { top: 92, right: 28 }
      : {};

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={label}
        title={label}
        onClick={() => {
          const next = isDark ? 'light' : 'dark';
          setTheme(next);
          // Persist per-user so the choice follows the account. No-ops on public
          // pages where there's no signed-in user (requireUserId rejects → caught).
          void setSetting(USER_THEME_SETTING_KEY, next).catch(() => {});
        }}
        className="focus-ring"
        style={{
          position: 'relative',
          width: PILL_WIDTH,
          height: HIT_HEIGHT,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: (HIT_HEIGHT - PILL_HEIGHT) / 2,
            width: PILL_WIDTH,
            height: PILL_HEIGHT,
            border: '1px solid var(--rule)',
            borderRadius: 999,
            background: 'var(--bg-elevated)',
            transition: 'background 200ms ease, border-color 200ms ease',
          }}
        >
        {/* Sun glyph (left) */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: !isDark ? '#ffffff' : 'var(--text-faint)',
            transition: 'color 200ms ease',
            pointerEvents: 'none',
          }}
        >
          <Sun size={14} strokeWidth={2} />
        </span>

        {/* Moon glyph (right) */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDark ? 'var(--ink-surface-text)' : 'var(--text-faint)',
            transition: 'color 200ms ease',
            pointerEvents: 'none',
          }}
        >
          <Moon size={14} strokeWidth={2} />
        </span>

        {/* Thumb */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: THUMB_INSET,
            left: mounted
              ? isDark
                ? PILL_WIDTH - THUMB_SIZE - THUMB_INSET
                : THUMB_INSET
              : THUMB_INSET,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: '50%',
            background: isDark ? 'var(--ink-surface)' : 'var(--accent)',
            boxShadow: isDark
              ? '0 2px 6px rgba(0,0,0,0.4)'
              : '0 2px 8px rgba(47,163,155,0.45)',
            transition:
              'left 320ms var(--ease-editorial), background 240ms ease, box-shadow 240ms ease',
            willChange: 'left',
          }}
        />
        </span>
      </button>
    </div>
  );
}

export default ThemeToggle;
