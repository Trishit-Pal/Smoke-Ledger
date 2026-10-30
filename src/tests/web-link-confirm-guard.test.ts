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

  it('the callback takes the link type from readAuthLink only (one source of truth)', () => {
    expect(route).not.toContain('parseEmailOtpType');
  });

  it('only the confirm page server action redeems, on POST', () => {
    const action = read('web', 'app', 'auth', 'confirm', 'actions.ts');
    expect(action.startsWith("'use server';")).toBe(true);
    expect(action).toContain('verifyOtp(');
    expect(action).toContain('postAuthDestination(');
    expect(action).toContain('nextPathForLink(');
    const page = read('web', 'app', 'auth', 'confirm', 'page.tsx');
    expect(page).toMatch(/<form action=\{confirmEmailLinkAction\}/);
  });

  // Review fix I2: CSRF protection must not rest on Next's accidental Origin check.
  it('the action refuses a cross-origin POST before redeeming anything', () => {
    const action = read('web', 'app', 'auth', 'confirm', 'actions.ts');
    const checkAt = action.indexOf('isSameOriginRequest(');
    expect(checkAt).toBeGreaterThan(-1);
    expect(checkAt).toBeLessThan(action.indexOf('verifyOtp('));
  });

  // Review fix: any signed-in session (phone-only included) gets the warning, and
  // the copy stays true when the link is for the same account.
  it('the page warns about any existing session, with copy true for the same account', () => {
    const page = read('web', 'app', 'auth', 'confirm', 'page.tsx');
    expect(page).toContain('maskAccount(');
    expect(page).not.toContain('maskEmail(');
    expect(page).toContain('If this link is for a different account, continuing switches to it.');
  });

  it('the page uses spacing tokens, not literals (CLAUDE.md)', () => {
    const page = read('web', 'app', 'auth', 'confirm', 'page.tsx');
    expect(page).not.toMatch(/margin(Top)?:\s*['"]?\d/);
  });

  it('middleware lets signed-in and signed-out visitors reach the confirm page', () => {
    expect(read('web', 'middleware.ts')).toMatch(/pathname === '\/auth\/confirm'/);
  });

  // Review fix I1: no-referrer makes a pre-hydration form POST send Origin: null,
  // which Next 14.2 answers with a 500. same-origin still hides the token from
  // other sites while keeping a real Origin on our own POST.
  it('the confirm page hides its token from other sites without breaking its own POST', () => {
    const config = read('web', 'next.config.mjs');
    expect(config).toContain("{ source: '/auth/confirm', headers: confirmSecurityHeaders }");
    expect(config).toMatch(
      /const confirmSecurityHeaders = \[[^\]]*key: 'Referrer-Policy', value: 'same-origin'/,
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
    expect(screen).toContain('maskAccount(');
    expect(screen).toContain('If this link is for a different account, continuing switches to it.');
  });

  // Review fixes for the mobile callback screen.
  it('a newer link replaces the pending one instead of being dropped', () => {
    const screen = read('app', 'auth', 'callback.tsx');
    expect(screen).toContain('if (url === lastUrl) return;');
    expect(screen).not.toContain('if (handled) return;');
  });

  it('the session lookup cannot strand the screen on a spinner', () => {
    expect(read('app', 'auth', 'callback.tsx')).toMatch(
      /try \{\s*const \{ data \} = await getSupabase\(\)\.auth\.getSession\(\);/,
    );
  });

  it('a pending link clears an earlier error, and redemption is single-flight and unmount-safe', () => {
    const screen = read('app', 'auth', 'callback.tsx');
    expect(screen).toMatch(/setError\(null\);\s*setPending\(/);
    expect(screen).toContain('if (inFlight.current) return;');
    expect(screen).toContain('if (!mounted.current) return;');
  });
});
