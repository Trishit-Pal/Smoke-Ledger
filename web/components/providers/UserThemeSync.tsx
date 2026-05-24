'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/store/auth';
import { getSetting } from '@/db/repositories/settings';
import { USER_THEME_SETTING_KEY, type StoredUserTheme } from '@web/lib/userTheme';

/**
 * Applies the signed-in user's stored theme preference (settings_kv key
 * `preferences.theme`) over next-themes' device-level value, so the dark/light
 * choice follows the account across devices/browsers.
 *
 * Runs once per user id per mount (guarded by a ref) so it never fights the
 * user's in-session toggle — `ThemeToggle` writes the preference back on change.
 * On the same device the next-themes localStorage value paints first (no flash);
 * the per-user value reconciles right after auth resolves.
 */
export function UserThemeSync() {
  const { setTheme } = useTheme();
  const session = useAuth((s) => s.session);
  const appliedForUser = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (!userId || appliedForUser.current === userId) return;
    appliedForUser.current = userId;
    getSetting<StoredUserTheme>(USER_THEME_SETTING_KEY)
      .then((pref) => {
        if (pref === 'light' || pref === 'dark') setTheme(pref);
      })
      .catch(() => {
        // No stored preference (or a transient read error) — keep the device value.
      });
  }, [session, setTheme]);

  return null;
}

export default UserThemeSync;
