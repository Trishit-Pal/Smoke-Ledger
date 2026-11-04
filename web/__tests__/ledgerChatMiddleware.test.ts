import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const middleware = readFileSync(join(__dirname, '..', 'middleware.ts'), 'utf8');

// The chat route accepts a native Bearer token with no cookie. The middleware
// redirects any session-less request to /login, so the route must be carved
// out before that check runs — and only that route, so every other API path
// keeps today's behaviour.
describe('middleware carve-out for /api/ledger-chat', () => {
  test('returns early for the chat route before any auth lookup', () => {
    const carveOut = middleware.indexOf("'/api/ledger-chat'");
    const getUser = middleware.indexOf('supabase.auth.getUser()');
    expect(carveOut).toBeGreaterThan(-1);
    expect(getUser).toBeGreaterThan(-1);
    expect(carveOut).toBeLessThan(getUser);
  });

  test('carves out only the chat route, not all API paths', () => {
    // Before the session lookup, only the chat route skips the gates. (After it,
    // API paths are exempt from the onboarding redirects, never from sign-in.)
    const beforeAuth = middleware.slice(
      middleware.indexOf('export async function middleware('),
      middleware.indexOf('supabase.auth.getUser()'),
    );
    expect(beforeAuth.length).toBeGreaterThan(0);
    expect(beforeAuth).not.toMatch(/startsWith\('\/api\/?'\)/);
    expect(beforeAuth).not.toMatch(/isApiRoute\(/);
  });
});
