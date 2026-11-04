import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { LEGAL_VERSIONS } from '@/lib/legal';

// The real middleware, with only Supabase faked: a confirmed, signed-in reader
// whose profile row is `state.row`. Every redirect is followed, so a loop or a
// wizard detour for an existing reader fails here, not in production.
const SIGNED_IN = { id: 'u1', email: 'r@example.com', email_confirmed_at: 't' };
const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  user: null as Record<string, unknown> | null,
  // A failed profile read (missing column, outage): maybeSingle gives { data: null, error }.
  error: null as { code: string; message: string } | null,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () =>
        state.error ? { data: null, error: state.error } : { data: state.row, error: null },
    };
    return {
      auth: {
        getUser: async () => ({ data: { user: state.user } }),
        signOut: async () => ({}),
      },
      from: () => chain,
    };
  },
}));

const { middleware } = await import('@web/middleware');

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
});
beforeEach(() => {
  state.user = SIGNED_IN;
  state.error = null;
});
afterAll(() => vi.unstubAllEnvs());

const MAX_HOPS = 6;

/** Follow the middleware's redirects from `path`; return every pathname visited. */
async function walk(path: string): Promise<string[]> {
  const seen = [path];
  let url = new URL(path, 'http://localhost');
  for (let i = 0; i < MAX_HOPS; i += 1) {
    const res = await middleware(new NextRequest(url));
    const location = res.headers.get('location');
    if (!location) return seen;
    url = new URL(location, url);
    if (seen.includes(url.pathname)) throw new Error(`redirect loop: ${[...seen, url.pathname].join(' -> ')}`);
    seen.push(url.pathname);
  }
  throw new Error(`no settle after ${MAX_HOPS} hops: ${seen.join(' -> ')}`);
}

const CURRENT = {
  onboarding_step: 'done',
  age_confirmed_at: 't',
  terms_version: LEGAL_VERSIONS.terms,
  privacy_version: LEGAL_VERSIONS.privacy,
  health_disclaimer_version: LEGAL_VERSIONS.medicalDisclaimer,
  data_processing_consent_at: 't',
  health_data_consent_at: 't',
};
const ONBOARDED = { ...CURRENT, onboarded_at: 't' };
const STAMPS = [
  'age_confirmed_at',
  'terms_version',
  'privacy_version',
  'health_disclaimer_version',
  'data_processing_consent_at',
  'health_data_consent_at',
] as const;
const PATHS = ['/', '/dashboard', '/onboarding', '/onboarding/privacy', '/onboarding/done', '/consent', '/settings'];

const NEEDS_REFRESH: [string, Record<string, unknown>][] = [
  ...STAMPS.map((k): [string, Record<string, unknown>] => [`missing ${k}`, { ...ONBOARDED, [k]: null }]),
  ['an outdated terms version', { ...ONBOARDED, terms_version: '2020-01-01' }],
];

describe('middleware: onboarded readers', () => {
  test.each(NEEDS_REFRESH)('%s: every path settles on /consent (or /settings), never the wizard', async (_n, row) => {
    state.row = row;
    for (const path of PATHS) {
      const hops = await walk(path);
      expect([path, hops.at(-1)]).toEqual([path, path === '/settings' ? '/settings' : '/consent']);
      expect(hops.slice(1).filter((p) => p.startsWith('/onboarding'))).toEqual([]);
    }
  });

  test('current: home is the dashboard; /onboarding/done stays only once the step is done', async () => {
    state.row = ONBOARDED;
    const expected: Record<string, string> = {
      '/': '/dashboard',
      '/dashboard': '/dashboard',
      '/onboarding': '/dashboard',
      '/onboarding/privacy': '/dashboard',
      '/onboarding/done': '/onboarding/done',
      '/consent': '/dashboard',
      '/settings': '/settings',
    };
    for (const path of PATHS) {
      const hops = await walk(path);
      expect([path, hops.at(-1)]).toEqual([path, expected[path]]);
    }
    state.row = { ...ONBOARDED, onboarding_step: 'brands' };
    expect((await walk('/onboarding/done')).at(-1)).toBe('/dashboard');
  });

  test('legal pages stay readable while a stamp is missing (the /consent page links to them)', async () => {
    state.row = { ...ONBOARDED, age_confirmed_at: null };
    for (const path of ['/privacy', '/terms']) expect(await walk(path)).toEqual([path]);
  });
});

// API routes answer for themselves (session, same-origin, their own consent gates).
// A redirect would turn the wizard's audit POST into an HTML 200 taken for success.
describe('middleware: API paths are never sent to an onboarding or consent page', () => {
  test.each([
    ['not onboarded, no consents', { onboarding_step: 'privacy' }],
    ['not onboarded, consented mid-wizard', { ...CURRENT, onboarding_step: 'goal' }],
    ['onboarded, missing age_confirmed_at', { ...ONBOARDED, age_confirmed_at: null }],
    ['onboarded, outdated', { ...ONBOARDED, terms_version: '2020-01-01' }],
  ])('%s', async (_n, row) => {
    state.row = row;
    for (const path of ['/api/audit', '/api/ledger-chat']) {
      const res = await middleware(new NextRequest(new URL(path, 'http://localhost'), { method: 'POST' }));
      expect([path, res.headers.get('location')]).toEqual([path, null]);
    }
  });

  test('the exemption is not a sign-in bypass: signed out, /api/audit still goes to /login', async () => {
    state.user = null;
    const res = await middleware(new NextRequest(new URL('/api/audit', 'http://localhost'), { method: 'POST' }));
    expect(new URL(res.headers.get('location') ?? '', 'http://localhost').pathname).toBe('/login');
  });
});

// A failed read is not "no row": it must never look like a new reader. Whatever the
// stored row would have said, the reader gets a calm 503 page, not the wizard or /consent.
describe('middleware: a failed profile read never sends a signed-in reader to onboarding or /consent', () => {
  const DB_ERROR = { code: '42703', message: 'column user_profiles.health_data_consent_at does not exist' };

  test.each([
    ['an onboarded reader', ONBOARDED],
    ['a new reader', null],
  ])('%s: pages answer 503 on the unavailable page, no redirect', async (_n, row) => {
    state.row = row;
    state.error = DB_ERROR;
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const path of ['/', '/dashboard', '/onboarding/privacy', '/consent']) {
      const res = await middleware(new NextRequest(new URL(path, 'http://localhost')));
      expect([path, res.headers.get('location'), res.status]).toEqual([path, null, 503]);
      expect(new URL(res.headers.get('x-middleware-rewrite') ?? '', 'http://localhost').pathname).toBe('/unavailable');
      expect(res.headers.get('content-security-policy')).toContain("'nonce-");
    }
    log.mockRestore();
  });

  test('logs the code once per request and nothing identifying', async () => {
    state.error = DB_ERROR;
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await middleware(new NextRequest(new URL('/dashboard', 'http://localhost')));
    expect(log).toHaveBeenCalledTimes(1);
    const [entry] = log.mock.calls[0] as [string];
    expect(JSON.parse(entry)).toEqual({ level: 'error', event: 'middleware.profile_read_failed', code: '42703' });
    log.mockRestore();
  });

  test('API paths go through to their own handlers: no redirect, no HTML 503', async () => {
    state.error = DB_ERROR;
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await middleware(new NextRequest(new URL('/api/audit', 'http://localhost'), { method: 'POST' }));
    expect([res.headers.get('location'), res.headers.get('x-middleware-rewrite'), res.status]).toEqual([null, null, 200]);
    log.mockRestore();
  });

  test('the unavailable page itself is reachable (no redirect loop)', async () => {
    state.row = null;
    expect(await walk('/unavailable')).toEqual(['/unavailable']);
  });

  test('signed out, a failed read is irrelevant: /dashboard still goes to /login', async () => {
    state.user = null;
    state.error = DB_ERROR;
    const res = await middleware(new NextRequest(new URL('/dashboard', 'http://localhost')));
    expect(new URL(res.headers.get('location') ?? '', 'http://localhost').pathname).toBe('/login');
  });
});

describe('middleware: readers still onboarding (unchanged)', () => {
  test.each([
    ['no profile row', null],
    ['no consents', { onboarding_step: 'privacy' }],
    ['missing age_confirmed_at mid-wizard', { ...CURRENT, onboarding_step: 'goal', age_confirmed_at: null }],
  ])('%s: the wizard resumes at privacy', async (_n, row) => {
    state.row = row;
    const expected: Record<string, string> = {
      '/': '/onboarding/privacy',
      '/dashboard': '/onboarding/privacy',
      '/onboarding': '/onboarding',
      '/onboarding/privacy': '/onboarding/privacy',
      '/onboarding/done': '/onboarding/privacy',
      '/consent': '/onboarding/privacy',
      '/settings': '/onboarding/privacy',
    };
    for (const path of PATHS) {
      expect([path, (await walk(path)).at(-1)]).toEqual([path, expected[path]]);
    }
  });

  test('the Terms and Privacy Policy stay readable before consenting (the Privacy step links to them)', async () => {
    for (const row of [null, { onboarding_step: 'privacy' }]) {
      state.row = row;
      for (const path of ['/privacy', '/terms', '/support']) expect(await walk(path)).toEqual([path]);
    }
  });

  test('consented mid-wizard: resumes at the saved step, never /consent', async () => {
    state.row = { ...CURRENT, onboarding_step: 'goal' };
    for (const path of ['/', '/dashboard', '/onboarding/done', '/consent', '/settings']) {
      expect([path, (await walk(path)).at(-1)]).toEqual([path, '/onboarding/goal']);
    }
  });
});
