/**
 * Review fix for security scan F2. The delete-account gate now requires a fresh
 * sign-in on the presenting session, and on reauth_required both clients send
 * the still-signed-in user to `/login?…reason=reauth`. But web middleware
 * bounced every signed-in visitor off /login to /dashboard, and the mobile
 * (auth) layout redirected any session to `/`, so the fresh sign-in could never
 * happen and account deletion (the DPDP erasure path) was unreachable.
 */
import * as fs from 'fs';
import * as path from 'path';
import { isReauthRequest } from '@/lib/reauth';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (...parts: string[]): string =>
  fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');

describe('isReauthRequest', () => {
  it('is true only for /login with reason=reauth', () => {
    expect(isReauthRequest('/login', 'reauth')).toBe(true);
  });

  it.each([
    ['/login', null],
    ['/login', 'expired'],
    ['/signup', 'reauth'],
    ['/reset', 'reauth'],
    ['/login/', 'reauth'],
    ['/dashboard', 'reauth'],
  ])('is false for %j with reason %j', (pathname, reason) => {
    expect(isReauthRequest(pathname, reason)).toBe(false);
  });
});

describe('a signed-in user can reach the re-auth sign-in', () => {
  it('web middleware lets reason=reauth through before bouncing signed-in users off auth routes', () => {
    const middleware = read('web', 'middleware.ts');
    const reauthAt = middleware.indexOf("isReauthRequest(pathname, url.searchParams.get('reason'))");
    const bounceAt = middleware.indexOf("NextResponse.redirect(new URL('/dashboard', request.url))");
    expect(reauthAt).toBeGreaterThan(-1);
    expect(bounceAt).toBeGreaterThan(-1);
    expect(reauthAt).toBeLessThan(bounceAt);
  });

  it('the mobile auth layout does not redirect a session away from a reauth sign-in', () => {
    const layout = read('app', '(auth)', '_layout.tsx');
    expect(layout).toContain('isReauthRequest(pathname, reason)');
    expect(layout).toMatch(/if \(session && !isReauthRequest\(pathname, reason\)\)/);
  });
});
