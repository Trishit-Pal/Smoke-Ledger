/**
 * One table of every store that can hold something about a reader, and the events that clear it.
 * The web and mobile cleanup helpers (web/lib/privacy/clearDevice.ts,
 * src/lib/privacy/clearDeviceNative.ts) run the clearer registered for each id, and tests fail
 * when a store here has no clearer. Adding a store means adding a row; the policy text and the
 * erase/delete/sign-out behaviour then follow from it.
 *
 * Events: signOut (session ends, any cause), erase (keep the account), delete (account gone),
 * withdraw (core consent withdrawn, which the reader resolves as erase or delete, so it clears
 * what erase clears), discreetOn (discreet mode turned on, so saved real names must go).
 */

export type LifecyclePlatform = 'web' | 'mobile' | 'server';
export type LifecycleEvent = 'signOut' | 'erase' | 'delete' | 'withdraw' | 'discreetOn';

export interface LifecycleStore {
  readonly id: string;
  readonly platform: LifecyclePlatform;
  readonly kind: 'cookie' | 'local-storage' | 'secure-store' | 'async-storage' | 'file' | 'memory' | 'os' | 'cache' | 'database';
  /** False only for device preferences that say nothing about the reader. */
  readonly personal: boolean;
  readonly clearOn: readonly LifecycleEvent[];
}

const ERASE_FAMILY = ['erase', 'delete', 'withdraw'] as const;

export const STORES: readonly LifecycleStore[] = [
  // Web device
  { id: 'web.authCookie', platform: 'web', kind: 'cookie', personal: true, clearOn: ['signOut', 'delete'] },
  { id: 'web.rememberMeCookie', platform: 'web', kind: 'cookie', personal: true, clearOn: ['delete'] },
  {
    id: 'web.chatTranscript',
    platform: 'web',
    kind: 'local-storage',
    personal: true,
    clearOn: ['signOut', ...ERASE_FAMILY, 'discreetOn'],
  },
  {
    id: 'web.firstSuggestion',
    platform: 'web',
    kind: 'local-storage',
    personal: true,
    clearOn: ['signOut', ...ERASE_FAMILY],
  },
  { id: 'web.lockKeys', platform: 'web', kind: 'local-storage', personal: true, clearOn: ERASE_FAMILY },
  { id: 'web.brandsCache', platform: 'web', kind: 'cache', personal: true, clearOn: ['erase', 'delete', 'withdraw'] },
  // Kept: device preferences, nothing personal.
  { id: 'web.theme', platform: 'web', kind: 'local-storage', personal: false, clearOn: [] },
  { id: 'web.catalog', platform: 'web', kind: 'local-storage', personal: false, clearOn: [] },

  // Mobile device
  { id: 'mobile.session', platform: 'mobile', kind: 'secure-store', personal: true, clearOn: ['signOut', 'delete'] },
  { id: 'mobile.inMemoryLedger', platform: 'mobile', kind: 'memory', personal: true, clearOn: ['signOut', 'delete'] },
  {
    id: 'mobile.firstSuggestion',
    platform: 'mobile',
    kind: 'async-storage',
    personal: true,
    clearOn: ['signOut', ...ERASE_FAMILY],
  },
  { id: 'mobile.lockKeys', platform: 'mobile', kind: 'secure-store', personal: true, clearOn: ERASE_FAMILY },
  { id: 'mobile.notifications', platform: 'mobile', kind: 'os', personal: true, clearOn: ERASE_FAMILY },
  { id: 'mobile.exportFile', platform: 'mobile', kind: 'file', personal: true, clearOn: ERASE_FAMILY },
  // Kept: device preferences, nothing personal.
  { id: 'mobile.theme', platform: 'mobile', kind: 'async-storage', personal: false, clearOn: [] },
  { id: 'mobile.catalog', platform: 'mobile', kind: 'async-storage', personal: false, clearOn: [] },

  // Server (cleared by the erase_account_data / delete-account functions, not by a device helper)
  { id: 'server.productRows', platform: 'server', kind: 'database', personal: true, clearOn: ['erase', 'delete', 'withdraw'] },
  { id: 'server.authIdentity', platform: 'server', kind: 'database', personal: true, clearOn: ['delete'] },
  { id: 'server.errorEvents', platform: 'server', kind: 'database', personal: true, clearOn: ['erase', 'delete', 'withdraw'] },
  { id: 'server.auditEvents', platform: 'server', kind: 'database', personal: true, clearOn: ['erase', 'delete', 'withdraw'] },
];

export type Clearer = () => void | Promise<void>;

/** Ids of the stores on one platform that the given event clears. */
export function storesToClear(platform: LifecyclePlatform, event: LifecycleEvent): readonly string[] {
  return STORES.filter((s) => s.platform === platform && s.clearOn.includes(event)).map((s) => s.id);
}

/**
 * Runs the clearer for every store the event clears. One failing clearer never stops the rest;
 * the ids that failed (or have no clearer) come back so a caller can log them. Never throws.
 */
export async function runLifecycleClearers(
  platform: LifecyclePlatform,
  event: LifecycleEvent,
  clearers: Readonly<Record<string, Clearer>>,
): Promise<string[]> {
  const ids = storesToClear(platform, event);
  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const clear = clearers[id];
      if (!clear) throw new Error(`no clearer registered for ${id}`);
      await clear();
    }),
  );
  return ids.filter((_, i) => results[i].status === 'rejected');
}

/** Logs which stores failed to clear (ids only, no personal data). Never throws. */
export async function reportFailedClears(
  platform: LifecyclePlatform,
  event: LifecycleEvent,
  failed: readonly string[],
): Promise<void> {
  if (failed.length === 0) return;
  try {
    // Loaded on demand: the logger pulls in the Supabase client.
    const { logClientError } = await import('@/lib/logger');
    await logClientError(new Error(`device clear failed: ${failed.join(',')}`), {
      category: 'client.lifecycle',
      route: `${platform}:${event}`,
    });
  } catch {
    // Reporting is best-effort.
  }
}
