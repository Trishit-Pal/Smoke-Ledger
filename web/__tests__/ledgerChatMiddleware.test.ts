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
    expect(middleware).not.toMatch(/startsWith\('\/api\/?'\)/);
    expect(middleware).not.toMatch(/startsWith\('\/api'\)/);
  });

  test('the carve-out is an exact match, so no sub-path of the chat route skips the middleware', () => {
    // The route re-applies the gates the middleware skips; a sub-path would get neither.
    expect(middleware).toContain("pathname === '/api/ledger-chat'");
    expect(middleware).not.toMatch(/startsWith\(\s*['"`]\/api\/ledger-chat/);
  });
});
