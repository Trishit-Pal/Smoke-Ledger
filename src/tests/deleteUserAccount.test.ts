/**
 * The client contract both Settings screens rely on: a reauth_required reply
 * fires the callback and throws WITHOUT signing out, a real "not signed in"
 * throws WITHOUT firing the callback, and only a clean 2xx clears the session.
 */
import { deleteUserAccount } from '@/services/deleteUserAccount';
import { useSession } from '@/store/session';
import { invalidateAnalyticsConsentCache } from '@/services/analytics';

const supabase = {
  auth: {
    getUser: jest.fn(),
    getSession: jest.fn(),
    signOut: jest.fn(),
  },
  functions: { invoke: jest.fn() },
};

jest.mock('@/lib/supabase', () => ({ getSupabase: () => supabase }));
jest.mock('@/store/session', () => ({
  useSession: { getState: jest.fn() },
}));
jest.mock('@/services/analytics', () => ({ invalidateAnalyticsConsentCache: jest.fn() }));

const reset = jest.fn();

/** supabase-js v2 shape for a non-2xx edge reply: data null, error carries the Response. */
const httpError = (body: unknown) => ({
  data: null,
  error: {
    message: 'Edge Function returned a non-2xx status code',
    context: { json: async () => body },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  (useSession.getState as jest.Mock).mockReturnValue({ reset });
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  supabase.auth.signOut.mockResolvedValue({ error: null });
});

describe('deleteUserAccount', () => {
  it('reauth_required: fires the callback once, throws authentication_error, never signs out', async () => {
    supabase.functions.invoke.mockResolvedValue(httpError({ error: 'reauth_required', window_min: 15 }));
    const onReauthRequired = jest.fn();

    await expect(deleteUserAccount({ onReauthRequired })).rejects.toMatchObject({
      code: 'authentication_error',
    });
    expect(onReauthRequired).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it('not signed in: throws authentication_error WITHOUT the reauth callback (so the UI must show it)', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'nope' } });
    const onReauthRequired = jest.fn();

    await expect(deleteUserAccount({ onReauthRequired })).rejects.toMatchObject({
      code: 'authentication_error',
    });
    expect(onReauthRequired).not.toHaveBeenCalled();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('2xx: signs out locally, resets the session store and clears the consent cache', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null });

    await expect(deleteUserAccount()).resolves.toBeUndefined();
    expect(supabase.functions.invoke).toHaveBeenCalledWith('delete-account', {
      headers: { Authorization: 'Bearer tok' },
    });
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(invalidateAnalyticsConsentCache).toHaveBeenCalledTimes(1);
  });

  it('maps the other structured server codes and never treats them as success', async () => {
    supabase.functions.invoke.mockResolvedValue(httpError({ error: 'rate_limited' }));
    await expect(deleteUserAccount()).rejects.toMatchObject({ code: 'rate_limited' });

    supabase.functions.invoke.mockResolvedValue(httpError({ error: 'erase_failed' }));
    await expect(deleteUserAccount()).rejects.toMatchObject({
      code: 'dependency_failure',
      message: 'erase_failed',
    });

    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('an unstructured failure (HTML 524, network) still throws', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Failed to fetch', context: { json: async () => 'not json' } },
    });
    await expect(deleteUserAccount()).rejects.toThrow('Failed to fetch');
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});
