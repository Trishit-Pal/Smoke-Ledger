import {
  applyAuthCookiePolicy,
  hardenCookieOptions,
  isRememberMeEnabled,
  isSupabaseAuthCookie,
} from '../../web/lib/supabase/cookieOptions';

describe('web cookieOptions', () => {
  it('detects remember-me preference', () => {
    expect(isRememberMeEnabled('1')).toBe(true);
    expect(isRememberMeEnabled('0')).toBe(false);
    expect(isRememberMeEnabled(undefined)).toBe(false);
  });

  it('strips maxAge when remember-me is off', () => {
    const out = applyAuthCookiePolicy({ maxAge: 604800, path: '/' }, false);
    expect(out.maxAge).toBeUndefined();
    expect(out.expires).toBeUndefined();
    expect(out.path).toBe('/');
  });

  it('keeps maxAge when remember-me is on', () => {
    const out = applyAuthCookiePolicy({ maxAge: 604800, path: '/' }, true);
    expect(out.maxAge).toBe(604800);
  });

  it('identifies supabase auth cookies', () => {
    expect(isSupabaseAuthCookie('sb-test-auth-token')).toBe(true);
    expect(isSupabaseAuthCookie('sl_remember_me')).toBe(false);
  });

  it('hardens defaults', () => {
    const out = hardenCookieOptions({ path: '/' });
    expect(out.path).toBe('/');
    expect(out.sameSite).toBe('lax');
  });
});
