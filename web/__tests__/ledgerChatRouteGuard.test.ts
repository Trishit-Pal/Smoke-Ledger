import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

// Source-scan pins for the chat route, in the style of auditRouteGuard.test.ts:
// the order of the guards is the security model, so a reorder must fail here.
const route = readFileSync(join(__dirname, '..', 'app', 'api', 'ledger-chat', 'route.ts'), 'utf8');
const turn = readFileSync(join(__dirname, '..', 'lib', 'server', 'ledgerChat', 'turn.ts'), 'utf8');
const prompt = readFileSync(join(__dirname, '..', 'lib', 'server', 'ledgerChat', 'prompt.ts'), 'utf8');

describe('ledger-chat route guards', () => {
  test('resolves the caller before reading the body', () => {
    const caller = route.indexOf('resolveChatCaller(');
    const body = route.indexOf('request.json()');
    expect(caller).toBeGreaterThan(-1);
    expect(body).toBeGreaterThan(-1);
    expect(caller).toBeLessThan(body);
  });

  test('checks the kill switch, consent, and limits before loading any data', () => {
    const killSwitch = route.indexOf('isLedgerChatEnabled()');
    const consent = route.indexOf(".from('settings_kv')");
    const limits = route.indexOf('checkRateLimits(');
    const loads = route.indexOf('loadProfile(');
    expect(route).toContain("'consent.ledgerChatOptIn'");
    expect(killSwitch).toBeGreaterThan(-1);
    expect(consent).toBeGreaterThan(killSwitch);
    expect(limits).toBeGreaterThan(consent);
    expect(loads).toBeGreaterThan(limits);
  });

  test('re-checks the onboarding consents the middleware carve-out skipped, before loading the ledger', () => {
    const profile = route.indexOf('loadProfile(');
    const consents = route.indexOf('hasRequiredConsents(');
    const logs = route.indexOf('loadLogsPage(');
    expect(consents).toBeGreaterThan(profile);
    expect(consents).toBeLessThan(logs);
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
