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

describe('requireSameOrigin', () => {
  // The audit API route had no CSRF check at all; it relied on SameSite=Lax alone.
  // This adapter reads the three request headers the server-action path already
  // checks, so a route handler and an action enforce the same rule.
  const { requireSameOrigin } = require('../../web/lib/security/sameOrigin') as typeof import('../../web/lib/security/sameOrigin');
  const req = (h: Record<string, string>) => new Request('https://app.example/api/x', { method: 'POST', headers: h });

  it('accepts a same-origin fetch and rejects a cross-site one', () => {
    expect(requireSameOrigin(req({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(requireSameOrigin(req({ 'sec-fetch-site': 'cross-site', origin: 'https://app.example' }))).toBe(false);
  });

  it('matches Origin against x-forwarded-host first, then host', () => {
    expect(requireSameOrigin(req({ origin: 'https://app.example', 'x-forwarded-host': 'app.example', host: 'internal' }))).toBe(true);
    expect(requireSameOrigin(req({ origin: 'https://app.example', host: 'app.example' }))).toBe(true);
    expect(requireSameOrigin(req({ origin: 'https://evil.example', host: 'app.example' }))).toBe(false);
  });

  it('fails closed with no Origin and no Fetch Metadata', () => {
    expect(requireSameOrigin(req({ host: 'app.example' }))).toBe(false);
  });
});
