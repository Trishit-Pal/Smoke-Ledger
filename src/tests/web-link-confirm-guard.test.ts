/**
 * Wiring guards for confirm-before-redeem (security scan F6 web, F3 mobile).
 * The decisions live in tested helpers (authLink, postAuthDestination); these
 * pin that every entry point actually routes through them. Source-level, like
 * the other web-* guards, because there are no component tests in this repo.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (...parts: string[]): string =>
  fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');

describe('web: opening a link never signs a browser in', () => {
  const route = read('web', 'app', 'auth', 'callback', 'route.ts');

  it('the GET callback never redeems a token_hash', () => {
    expect(route).not.toContain('verifyOtp');
    expect(route).toContain('confirmLinkPath(');
  });

  it('the callback classifies links with readAuthLink and routes with postAuthDestination', () => {
    expect(route).toContain('readAuthLink(');
    expect(route).toContain('postAuthDestination(');
  });

  it('only the confirm page server action redeems, on POST', () => {
    const action = read('web', 'app', 'auth', 'confirm', 'actions.ts');
    expect(action.startsWith("'use server';")).toBe(true);
    expect(action).toContain('verifyOtp(');
    expect(action).toContain('postAuthDestination(');
    const page = read('web', 'app', 'auth', 'confirm', 'page.tsx');
    expect(page).toMatch(/<form action=\{confirmEmailLinkAction\}/);
    expect(page).toContain('maskEmail(');
  });

  it('middleware lets signed-in and signed-out visitors reach the confirm page', () => {
    expect(read('web', 'middleware.ts')).toMatch(/pathname === '\/auth\/confirm'/);
  });

  it('the confirm page never leaks its token through Referer', () => {
    expect(read('web', 'next.config.mjs')).toContain(
      "{ source: '/auth/confirm', headers: callbackSecurityHeaders }",
    );
  });
});

describe('mobile: a deep link never signs the app in by itself', () => {
  it('raw session tokens from a link are never accepted', () => {
    expect(read('src', 'lib', 'authCallback.ts')).not.toContain('setSession');
  });

  it('the callback screen asks before redeeming a token_hash link', () => {
    const screen = read('app', 'auth', 'callback.tsx');
    expect(screen).toContain('readAuthLink(');
    expect(screen).toContain("link.kind === 'confirm'");
    expect(screen).toContain('maskEmail(');
  });
});
