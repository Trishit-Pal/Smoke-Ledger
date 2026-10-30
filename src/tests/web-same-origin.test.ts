/**
 * Review fix (I2) for the confirm-page server action. Its CSRF protection was
 * Next 14.2's origin check, which rejects a cross-site POST with `Origin: null`
 * only because `new URL('null')` happens to throw, and lets a missing Origin
 * through. Redeeming a sign-in link is exactly what a login-CSRF page would
 * try, so the action checks same-origin itself.
 */
import { isSameOriginRequest } from '../../web/lib/security/sameOrigin';

const HOST = 'app.example';

describe('isSameOriginRequest', () => {
  it('trusts Sec-Fetch-Site when the browser sends it', () => {
    expect(isSameOriginRequest({ secFetchSite: 'same-origin', origin: null, host: HOST })).toBe(true);
    expect(isSameOriginRequest({ secFetchSite: 'cross-site', origin: `https://${HOST}`, host: HOST })).toBe(false);
    expect(isSameOriginRequest({ secFetchSite: 'same-site', origin: `https://${HOST}`, host: HOST })).toBe(false);
    expect(isSameOriginRequest({ secFetchSite: 'none', origin: null, host: HOST })).toBe(false);
  });

  it('falls back to an exact Origin host match on browsers without Fetch Metadata', () => {
    expect(isSameOriginRequest({ secFetchSite: null, origin: `https://${HOST}`, host: HOST })).toBe(true);
    expect(isSameOriginRequest({ secFetchSite: null, origin: 'https://evil.example', host: HOST })).toBe(false);
    expect(isSameOriginRequest({ secFetchSite: null, origin: `https://${HOST}.evil.example`, host: HOST })).toBe(false);
  });

  it.each([
    ['no Origin', null],
    ['opaque Origin', 'null'],
    ['garbage Origin', 'not a url'],
  ])('fails closed with %s and no Fetch Metadata', (_label, origin) => {
    expect(isSameOriginRequest({ secFetchSite: null, origin, host: HOST })).toBe(false);
  });

  it('fails closed without a host', () => {
    expect(isSameOriginRequest({ secFetchSite: null, origin: `https://${HOST}`, host: null })).toBe(false);
  });
});
