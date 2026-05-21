import { REMEMBER_ME_COOKIE } from '@web/lib/supabase/cookieOptions';

const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

/** Persist remember-me preference before sign-in (read by cookie adapters on auth exchange). */
export function setRememberMePreference(remember: boolean): void {
  if (typeof document === 'undefined') return;
  if (remember) {
    document.cookie = `${REMEMBER_ME_COOKIE}=1; path=/; max-age=${ONE_YEAR_SEC}; SameSite=Lax`;
  } else {
    document.cookie = `${REMEMBER_ME_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function readRememberMePreference(): boolean {
  if (typeof document === 'undefined') return false;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REMEMBER_ME_COOKIE}=`));
  return match?.split('=')[1] === '1';
}
