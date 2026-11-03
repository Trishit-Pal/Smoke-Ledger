import { afterEach, describe, expect, test } from 'vitest';
import { STORES } from '@/lib/privacy/lifecycle';
import { WEB_CLEARER_IDS, clearWebDevice } from '@web/lib/privacy/clearDevice';
import { firstSuggestionKey } from '@/lib/goals/firstSuggestionDismissal';

function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe('web device cleanup', () => {
  test('has a clearer for exactly the web stores that clear on some event', () => {
    const expected = STORES.filter((s) => s.platform === 'web' && s.clearOn.length > 0)
      .map((s) => s.id)
      .sort();
    expect([...WEB_CLEARER_IDS].sort()).toEqual(expected);
  });

  test('sign-out removes every first-suggestion key and the transcript, and leaves device preferences', async () => {
    const store = fakeStorage({
      [firstSuggestionKey('u1')]: '2026-11-01',
      [firstSuggestionKey('u2')]: '2026-11-02',
      'ledger-chat:v1:u1': '[]',
      'smoke-ledger-theme': 'dark',
      sl_catalog_sync_v: '3',
      sl_chat_dock_minimised: '1',
    });
    const failed = await clearWebDevice('signOut', store);
    expect(store.getItem(firstSuggestionKey('u1'))).toBeNull();
    expect(store.getItem(firstSuggestionKey('u2'))).toBeNull();
    expect(store.getItem('ledger-chat:v1:u1')).toBeNull();
    expect(store.getItem('smoke-ledger-theme')).toBe('dark');
    expect(store.getItem('sl_catalog_sync_v')).toBe('3');
    expect(store.getItem('sl_chat_dock_minimised')).toBe('1');
    expect(failed).toEqual([]);
  });

  test('discreet-on drops the transcript but keeps the first-suggestion key', async () => {
    const store = fakeStorage({ [firstSuggestionKey('u1')]: '2026-11-01', 'ledger-chat:v1:u1': '[]' });
    await clearWebDevice('discreetOn', store);
    expect(store.getItem('ledger-chat:v1:u1')).toBeNull();
    expect(store.getItem(firstSuggestionKey('u1'))).toBe('2026-11-01');
  });
});

describe('keeping a store', () => {
  const g = globalThis as { document?: { cookie: string } };
  afterEach(() => {
    delete g.document;
  });

  test('a kept id is skipped (auth cookie survives) while the rest still clear', async () => {
    g.document = { cookie: 'sb-abc-auth-token=v' };
    const store = fakeStorage({ 'ledger-chat:v1:u1': '[]' });
    const failed = await clearWebDevice('signOut', store, ['web.authCookie']);
    expect(g.document.cookie).toBe('sb-abc-auth-token=v');
    expect(store.getItem('ledger-chat:v1:u1')).toBeNull();
    expect(failed).toEqual([]);
  });

  test('without keep, sign-out expires the auth cookie', async () => {
    g.document = { cookie: 'sb-abc-auth-token=v' };
    await clearWebDevice('signOut', fakeStorage());
    expect(g.document.cookie).toContain('max-age=0');
  });
});
