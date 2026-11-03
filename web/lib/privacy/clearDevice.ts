// Web half of the lifecycle registry (src/lib/privacy/lifecycle.ts): one clearer per web store id,
// run together for an event. Never throws; the ids that failed come back for the caller to log.

import { reportFailedClears, runLifecycleClearers, type Clearer, type LifecycleEvent } from '@/lib/privacy/lifecycle';
import { clearTranscript } from '@web/components/chat/transcriptStore';
import { clearFirstSuggestionDismissals } from '@web/lib/goals/firstSuggestionStore';
import { setRememberMePreference } from '@web/lib/auth/rememberMe';
import { wipeSecureStore } from '@web/lib/storage';

const SUPABASE_COOKIE_PREFIX = 'sb-';

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Expires the Supabase auth cookies this page can see (chunked ones included). */
function expireAuthCookies(): void {
  if (typeof document === 'undefined') return;
  document.cookie
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter((name) => name.startsWith(SUPABASE_COOKIE_PREFIX))
    .forEach((name) => {
      document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
    });
}

function webClearers(store: Storage | null): Record<string, Clearer> {
  return {
    'web.authCookie': expireAuthCookies,
    'web.rememberMeCookie': () => setRememberMePreference(false),
    'web.chatTranscript': () => clearTranscript(undefined, store),
    'web.firstSuggestion': () => clearFirstSuggestionDismissals(store),
    'web.lockKeys': wipeSecureStore,
    'web.brandsCache': async () => {
      // Loaded on demand: the revalidate server action is only needed when this runs.
      const { safeRevalidateBrands } = await import('@web/lib/safeRevalidate');
      await safeRevalidateBrands();
    },
  };
}

/** Ids this module can clear; a test pins them to the registry. */
export const WEB_CLEARER_IDS: readonly string[] = Object.keys(webClearers(null));

/** `keep` lists store ids to leave alone for this run (e.g. the auth cookie on a non-SIGNED_OUT null session). */
export async function clearWebDevice(
  event: LifecycleEvent,
  store: Storage | null = defaultStorage(),
  keep: readonly string[] = [],
): Promise<string[]> {
  const clearers = Object.fromEntries(
    Object.entries(webClearers(store)).map(([id, clear]): [string, Clearer] => [id, keep.includes(id) ? () => {} : clear]),
  );
  const failed = await runLifecycleClearers('web', event, clearers);
  await reportFailedClears('web', event, failed);
  return failed;
}
