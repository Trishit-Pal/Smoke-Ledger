import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

// Source-scan pins for the chat route, in the style of auditRouteGuard.test.ts:
// the order of the guards is the security model, so a reorder must fail here.
const route = readFileSync(join(__dirname, '..', 'app', 'api', 'ledger-chat', 'route.ts'), 'utf8');
const turn = readFileSync(join(__dirname, '..', 'lib', 'server', 'ledgerChat', 'turn.ts'), 'utf8');
const prompt = readFileSync(join(__dirname, '..', 'lib', 'server', 'ledgerChat', 'prompt.ts'), 'utf8');
const auth = readFileSync(join(__dirname, '..', 'lib', 'server', 'ledgerChat', 'auth.ts'), 'utf8');
const middleware = readFileSync(join(__dirname, '..', 'middleware.ts'), 'utf8');

describe('ledger-chat route guards', () => {
  test('resolves the caller before reading the body', () => {
    const caller = route.indexOf('resolveChatCaller(');
    const body = route.indexOf('request.json()');
    expect(caller).toBeGreaterThan(-1);
    expect(body).toBeGreaterThan(-1);
    expect(caller).toBeLessThan(body);
  });

  test('gate order: kill switch, consent key, profile gates, then limits, then the ledger loads', () => {
    const killSwitch = route.indexOf('isLedgerChatEnabled()');
    const consent = route.indexOf(".from('settings_kv')");
    const profile = route.indexOf('loadProfile(');
    const consents = route.indexOf('hasRequiredConsents(');
    const limits = route.indexOf('checkRateLimits(');
    const logs = route.indexOf('loadLogsPage(');
    expect(route).toContain("'consent.ledgerChatOptIn'");
    expect(killSwitch).toBeGreaterThan(-1);
    expect(consent).toBeGreaterThan(killSwitch);
    // The profile gates run before a daily token is spent, so a reader without
    // consents is refused without losing one of their asks.
    expect(profile).toBeGreaterThan(consent);
    expect(consents).toBeGreaterThan(profile);
    expect(limits).toBeGreaterThan(consents);
    expect(logs).toBeGreaterThan(limits);
  });

  test('the confirmed-email rule is the shared one, not a copy', () => {
    expect(auth).toContain("isEmailConfirmed } from '@/lib/compliance'");
    expect(middleware).toContain('isEmailConfirmed(');
    expect(auth).not.toMatch(/function isConfirmed/);
  });

  test('the region is the one next to the Ohio database', () => {
    expect(route).toContain("export const preferredRegion = 'cle1'");
  });

  test('never calls the cookie-path getServer* loaders (they redirect)', () => {
    expect(route).not.toMatch(/getServer[A-Z]\w*\(/);
  });

  test('exports maxDuration and a region next to the database', () => {
    expect(route).toMatch(/export const maxDuration = \d+/);
    expect(route).toMatch(/export const preferredRegion = '(iad1|cle1)'/);
  });

  test('the turn engine and prompt stay free of Next-bound imports', () => {
    for (const src of [turn, prompt]) {
      expect(src).not.toMatch(/from '@web\/lib\/server\/data'/);
      expect(src).not.toMatch(/from '@web\/lib\/auth\/rateLimit'/);
      expect(src).not.toMatch(/from 'next\//);
    }
  });

  test('the system prompt forbids numbers, links, medical advice, and judgement', () => {
    for (const must of ['never write', 'medical', 'link', 'judge']) {
      expect(prompt.toLowerCase()).toContain(must);
    }
  });
});

describe('ledger-chat log window', () => {
  test('reads the same 2000-row goal window as Home, not a private 200 cap', () => {
    expect(route).toMatch(/import \{[^}]*GOAL_WINDOW_LOG_LIMIT[^}]*\} from '@web\/lib\/server\/data'/);
    expect(route).toContain('limit: GOAL_WINDOW_LOG_LIMIT');
    expect(route).not.toMatch(/LOG_ROW_CAP|limit:\s*200/);
  });
});
