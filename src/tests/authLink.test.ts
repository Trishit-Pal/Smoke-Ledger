/**
 * Security scan F6 (web) / F3 (mobile), CWE-352: a token_hash sign-in link is
 * not bound to the device that requested it, so merely OPENING one (an
 * attacker's link, a navigation, a mail scanner) signed that device into the
 * link's account. Links are now classified first: a PKCE `code` is
 * device-bound and may be exchanged at once; a `token_hash` must be confirmed
 * by the person on the device before it is redeemed.
 */
import { confirmLinkPath, maskEmail, readAuthLink } from '@/lib/authLink';

const params = (s: string) => new URLSearchParams(s);

describe('readAuthLink', () => {
  it.each(['magiclink', 'recovery', 'signup', 'email'])('a %s token_hash link needs confirmation', (type) => {
    expect(readAuthLink(params(`token_hash=abc&type=${type}`))).toEqual({
      kind: 'confirm',
      tokenHash: 'abc',
      type,
    });
  });

  it('a PKCE code link is device-bound and can be exchanged directly', () => {
    expect(readAuthLink(params('code=xyz'))).toEqual({ kind: 'exchange', code: 'xyz' });
  });

  it('prefers the code when both are present, as the callback always has', () => {
    expect(readAuthLink(params('code=xyz&token_hash=abc&type=magiclink')).kind).toBe('exchange');
  });

  it.each([
    'token_hash=abc',
    'token_hash=abc&type=invite',
    'token_hash=abc&type=email_change',
    'type=magiclink',
    'token_hash=&type=magiclink',
    '',
    // Raw session tokens are never accepted from a link (old implicit flow).
    'access_token=a&refresh_token=b',
  ])('rejects %j', (query) => {
    expect(readAuthLink(params(query))).toEqual({ kind: 'invalid' });
  });
});

describe('confirmLinkPath', () => {
  it('carries the token, type and a sanitized next to the confirm page', () => {
    const path = confirmLinkPath({ tokenHash: 'abc', type: 'magiclink' }, '/log?ref=widget');
    const url = new URL(path, 'https://app.example');
    expect(url.pathname).toBe('/auth/confirm');
    expect(url.searchParams.get('token_hash')).toBe('abc');
    expect(url.searchParams.get('type')).toBe('magiclink');
    expect(url.searchParams.get('next')).toBe('/log?ref=widget');
  });

  it('omits next when there is none', () => {
    expect(confirmLinkPath({ tokenHash: 'abc', type: 'recovery' }, null)).toBe(
      '/auth/confirm?token_hash=abc&type=recovery',
    );
  });
});

describe('maskEmail', () => {
  it.each([
    ['jane.doe@example.com', 'j•••@example.com'],
    ['a@b.co', 'a•••@b.co'],
    ['  Jane@Example.com ', 'J•••@Example.com'],
  ])('%j -> %j', (email, masked) => {
    expect(maskEmail(email)).toBe(masked);
  });

  it.each([null, undefined, '', 'not-an-email', '@example.com'])('returns null for %j', (email) => {
    expect(maskEmail(email)).toBeNull();
  });
});
