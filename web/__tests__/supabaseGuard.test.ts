import { describe, it, expect, vi, afterEach } from 'vitest';

// Regression: the browser Supabase client must refuse to run in a server context.
// This is the guard added after the /onboarding/done bug, where a server
// component used the browser client (no document/session) and silently returned
// empty data. The guard converts that into a loud, descriptive error.
describe('getSupabase() server-context guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('throws when called without a browser window', async () => {
    vi.stubGlobal('window', undefined);
    vi.resetModules();
    const { getSupabase } = await import('@web/lib/supabase/client');
    expect(() => getSupabase()).toThrowError(/server context/i);
  });
});
