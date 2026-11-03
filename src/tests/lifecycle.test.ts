import * as fs from 'fs';
import * as path from 'path';
import {
  STORES,
  reportFailedClears,
  runLifecycleClearers,
  storesToClear,
  type LifecycleEvent,
} from '../lib/privacy/lifecycle';
import { NATIVE_CLEARER_IDS } from '../lib/privacy/clearDeviceNative';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const read = (...parts: string[]): string =>
  fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');

describe('lifecycle registry', () => {
  it('has unique ids, each prefixed with its platform', () => {
    const ids = STORES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of STORES) expect(s.id.startsWith(`${s.platform}.`)).toBe(true);
  });

  it('only leaves a store out of every event when it is not personal data', () => {
    for (const s of STORES.filter((x) => x.clearOn.length === 0)) {
      expect(s.personal).toBe(false);
    }
    expect(STORES.filter((s) => !s.personal).map((s) => s.id).sort()).toEqual([
      'mobile.catalog',
      'mobile.theme',
      'web.catalog',
      'web.chatDockMinimised',
      'web.theme',
    ]);
  });

  it('exposes mobile clearers for exactly the mobile stores that clear on some event', () => {
    const expected = STORES.filter((s) => s.platform === 'mobile' && s.clearOn.length > 0)
      .map((s) => s.id)
      .sort();
    expect([...NATIVE_CLEARER_IDS].sort()).toEqual(expected);
  });

  const ids = (platform: 'web' | 'mobile' | 'server', event: LifecycleEvent) =>
    [...storesToClear(platform, event)].sort();

  it('clears the web device on sign-out: transcript, first-suggestion key, auth cookie', () => {
    expect(ids('web', 'signOut')).toEqual(['web.authCookie', 'web.chatTranscript', 'web.firstSuggestion']);
  });

  it('clears the mobile device on sign-out: session, in-memory ledger, first-suggestion key', () => {
    expect(ids('mobile', 'signOut')).toEqual([
      'mobile.firstSuggestion',
      'mobile.inMemoryLedger',
      'mobile.session',
    ]);
  });

  it('erase adds the lock keys, brands cache, notifications and export file; keeps the session', () => {
    expect(ids('web', 'erase')).toEqual([
      'web.brandsCache',
      'web.chatTranscript',
      'web.firstSuggestion',
      'web.lockKeys',
    ]);
    expect(ids('mobile', 'erase')).toEqual([
      'mobile.exportFile',
      'mobile.firstSuggestion',
      'mobile.lockKeys',
      'mobile.notifications',
    ]);
  });

  it('delete clears everything erase does, plus the sign-in material and remember-me cookie', () => {
    for (const platform of ['web', 'mobile'] as const) {
      for (const id of storesToClear(platform, 'erase')) {
        expect(storesToClear(platform, 'delete')).toContain(id);
      }
    }
    expect(ids('web', 'delete')).toContain('web.rememberMeCookie');
    expect(ids('web', 'delete')).toContain('web.authCookie');
    expect(ids('mobile', 'delete')).toContain('mobile.session');
  });

  it('withdrawing core consent clears what erase clears', () => {
    expect(ids('web', 'withdraw')).toEqual(ids('web', 'erase'));
    expect(ids('mobile', 'withdraw')).toEqual(ids('mobile', 'erase'));
  });

  it('discreet-on drops only the chat transcript', () => {
    expect(ids('web', 'discreetOn')).toEqual(['web.chatTranscript']);
    expect(ids('mobile', 'discreetOn')).toEqual([]);
  });
});

describe('runLifecycleClearers', () => {
  it('runs every registered clearer for the event and reports the ones that failed', async () => {
    const ran: string[] = [];
    const clearers = {
      'web.chatTranscript': () => void ran.push('chat'),
      'web.firstSuggestion': async () => {
        throw new Error('boom');
      },
      'web.authCookie': async () => void ran.push('cookie'),
    };
    const failed = await runLifecycleClearers('web', 'signOut', clearers);
    expect(ran.sort()).toEqual(['chat', 'cookie']);
    expect(failed).toEqual(['web.firstSuggestion']);
  });

  it('reports a registered store that has no clearer, so a new store cannot be forgotten silently', async () => {
    const failed = await runLifecycleClearers('web', 'discreetOn', {});
    expect(failed).toEqual(['web.chatTranscript']);
  });
});

describe('reportFailedClears', () => {
  it('does nothing when every clear succeeded', async () => {
    await expect(reportFailedClears('web', 'signOut', [])).resolves.toBeUndefined();
  });
});

describe('edge rate-limit keys', () => {
  it.each(['audit-record', 'delete-account'])('%s never keys a counter by a raw user id', (fn) => {
    const src = read('supabase', 'functions', fn, 'index.ts');
    expect(src).not.toMatch(/key:\s*`user:\$\{(user\.id|userId)\}`/);
    expect(src).toMatch(/key:\s*`user:\$\{await hashWithPepper\(/);
  });
});

describe('mobile wiring', () => {
  const settings = read('app', '(tabs)', 'settings.tsx');
  const layout = read('app', '_layout.tsx');

  it('clears the device only on an explicit SIGNED_OUT, never on a null INITIAL_SESSION', () => {
    expect(layout).toMatch(/if \(event === 'SIGNED_OUT'\) void clearNativeDevice\('signOut'\)/);
    // The only call site sits behind that guard.
    expect(layout.match(/clearNativeDevice\('signOut'\)/g)).toHaveLength(1);
  });

  it('web: every null session clears the localStorage stores; only SIGNED_OUT expires the auth cookies', () => {
    const authProvider = read('web', 'components', 'providers', 'AuthProvider.tsx');
    expect(authProvider).toMatch(/if \(event === 'SIGNED_OUT'\) void clearWebDevice\('signOut'\);\s*else void clearWebDevice\('signOut', undefined, \['web\.authCookie'\]\)/);
    // The full clear (cookies included) has exactly one call site, behind the guard.
    expect(authProvider.match(/clearWebDevice\('signOut'\)/g)).toHaveLength(1);
  });

  it('erase and delete run the registry clearers instead of ad-hoc wipes', () => {
    expect(settings).toContain("clearNativeDevice('erase')");
    expect(settings).toContain("clearNativeDevice('delete')");
    expect(settings).not.toContain('wipeSecureStore');
    expect(settings).not.toContain('cancelAll');
  });

  it('deletes the export file right after sharing it', () => {
    expect(settings).toMatch(/Sharing\.shareAsync[\s\S]{0,300}finally[\s\S]{0,200}deleteExportFile\(path\)/);
  });
});
