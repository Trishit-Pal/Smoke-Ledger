import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// resolveChatCaller runs for real; only the two Supabase client factories are
// replaced, so the origin check, the Bearer parse and the email-confirmed
// gate are what is under test. The handler tests mock this whole module.
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createSupabaseClient: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createSupabaseClient }));
vi.mock('@web/lib/supabase/server', () => ({ createClient: mocks.createServerClient }));

const { resolveChatCaller } = await import('@web/lib/server/ledgerChat/auth');

const CONFIRMED = { id: 'user-1', email: 'a@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' };
const UNCONFIRMED = { id: 'user-2', email: 'b@example.com', email_confirmed_at: null };

function request(headers: Record<string, string>): Request {
  return new Request('https://app.example.com/api/ledger-chat', { method: 'POST', headers });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  const client = { auth: { getUser: mocks.getUser } };
  mocks.createSupabaseClient.mockReturnValue(client);
  mocks.createServerClient.mockResolvedValue(client);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('resolveChatCaller', () => {
  test('refuses a cross-origin cookie request without touching the session', async () => {
    const res = await resolveChatCaller(request({ 'sec-fetch-site': 'cross-site' }));
    expect(res).toEqual({ ok: false, status: 403, error: 'forbidden' });
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  test('refuses a cookie request that says nothing about its origin', async () => {
    const res = await resolveChatCaller(request({}));
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  test('accepts a same-origin cookie request from a confirmed user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: CONFIRMED }, error: null });
    const res = await resolveChatCaller(request({ 'sec-fetch-site': 'same-origin' }));
    expect(res).toMatchObject({ ok: true, caller: { userId: 'user-1' } });
  });

  test('refuses a same-origin cookie request with no session', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });
    const res = await resolveChatCaller(request({ 'sec-fetch-site': 'same-origin' }));
    expect(res).toEqual({ ok: false, status: 401, error: 'unauthorized' });
  });

  test('refuses a Bearer token whose email is not confirmed', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: UNCONFIRMED }, error: null });
    const res = await resolveChatCaller(request({ authorization: 'Bearer jwt-abc' }));
    expect(res).toEqual({ ok: false, status: 401, error: 'unauthorized' });
  });

  test('refuses a Bearer token Supabase rejects', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });
    const res = await resolveChatCaller(request({ authorization: 'Bearer bad' }));
    expect(res).toEqual({ ok: false, status: 401, error: 'unauthorized' });
  });

  test('accepts a valid Bearer token with its own user id, and needs no same-origin proof', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: CONFIRMED }, error: null });
    const res = await resolveChatCaller(request({ authorization: 'Bearer jwt-abc', 'sec-fetch-site': 'cross-site' }));
    expect(res).toMatchObject({ ok: true, caller: { userId: 'user-1' } });
    expect(mocks.getUser).toHaveBeenCalledWith('jwt-abc');
    // The data client carries the caller's own JWT, so RLS scopes every read.
    expect(mocks.createSupabaseClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'anon-key',
      expect.objectContaining({ global: { headers: { Authorization: 'Bearer jwt-abc' } } }),
    );
  });

  test('fails closed when the Supabase env is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const res = await resolveChatCaller(request({ authorization: 'Bearer jwt-abc' }));
    expect(res).toEqual({ ok: false, status: 500, error: 'server_misconfigured' });
  });
});
