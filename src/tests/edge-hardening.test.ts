import * as fs from 'fs';
import * as path from 'path';
import { hashWithPepper, sha256Hex } from '../../supabase/functions/_shared/hash';
import { markClientReported } from '../../supabase/functions/_shared/auditAllowlist';
import { isFreshWebhookTimestamp } from '../../supabase/functions/_shared/webhookTimestamp';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const read = (...parts: string[]): string =>
  fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');

describe('isFreshWebhookTimestamp', () => {
  const now = 1_800_000_000_000; // ms

  it('accepts a timestamp inside the 5 minute window, in either direction', () => {
    expect(isFreshWebhookTimestamp('1800000000', now)).toBe(true);
    expect(isFreshWebhookTimestamp(String(1_800_000_000 - 299), now)).toBe(true);
    expect(isFreshWebhookTimestamp(String(1_800_000_000 + 299), now)).toBe(true);
  });

  it('rejects a replayed (stale) or far-future timestamp', () => {
    expect(isFreshWebhookTimestamp(String(1_800_000_000 - 301), now)).toBe(false);
    expect(isFreshWebhookTimestamp(String(1_800_000_000 + 301), now)).toBe(false);
  });

  it.each(['', 'abc', '-5', '1.5e9', '18000000000000000', ' 1800000000'])(
    'rejects malformed value %j',
    (raw) => {
      expect(isFreshWebhookTimestamp(raw, now)).toBe(false);
    },
  );
});

describe('hashWithPepper', () => {
  it('is the documented id:pepper form, so every function hashes the same way', async () => {
    expect(await hashWithPepper('user-1', 'p')).toBe(await sha256Hex('user-1:p'));
  });

  it('changes with the pepper, so a hashed IPv4 cannot be reversed without it', async () => {
    expect(await hashWithPepper('203.0.113.7', 'a')).not.toBe(
      await hashWithPepper('203.0.113.7', 'b'),
    );
    expect(await hashWithPepper('203.0.113.7', 'a')).not.toBe(await sha256Hex('203.0.113.7'));
  });
});

describe('markClientReported', () => {
  it('stamps client-submitted audit rows and cannot be overridden by the client', () => {
    expect(markClientReported({ screen: 'settings', source: 'server' })).toEqual({
      screen: 'settings',
      source: 'client_reported',
    });
    expect(markClientReported({})).toEqual({ source: 'client_reported' });
  });
});

describe('edge functions use the hardened helpers', () => {
  const deleteAccount = read('supabase', 'functions', 'delete-account', 'index.ts');
  const smsHook = read('supabase', 'functions', 'send-sms-otp', 'index.ts');
  const auditRecord = read('supabase', 'functions', 'audit-record', 'index.ts');

  it('delete-account never stores or keys on an unpeppered IP hash', () => {
    expect(deleteAccount).not.toMatch(/sha256Hex\(ip\)/);
    expect(deleteAccount).toMatch(/hashWithPepper\(ip,/);
  });

  it('send-sms-otp rejects stale webhooks before verifying and keys on a peppered phone hash', () => {
    expect(smsHook).toContain('isFreshWebhookTimestamp(webhookTimestamp');
    expect(smsHook.indexOf('isFreshWebhookTimestamp(')).toBeLessThan(
      smsHook.indexOf('verifyWebhookSignature('),
    );
    expect(smsHook).not.toMatch(/key: `phone:\$\{phone\}`/);
    expect(smsHook).toMatch(/hashWithPepper\(phone,/);
  });

  it.each([
    ['delete-account', () => deleteAccount],
    ['send-sms-otp', () => smsHook],
  ])('%s fails closed when AUDIT_PEPPER is missing instead of storing a reversible hash', (_n, src) => {
    const code = src();
    expect(code).not.toMatch(/AUDIT_PEPPER'\) \?\? ''/);
    expect(code).toMatch(/!pepper/);
    expect(code).toMatch(/server_misconfigured/);
    expect(code).not.toContain('audit_pepper_missing_phone_hash_weak');
  });

  it('audit-record stamps what the client reported', () => {
    expect(auditRecord).toContain('markClientReported(redactAuditProps(props))');
  });

  it('SQL erase hashes the user id the same way as the edge functions (id:pepper)', () => {
    const migration = read('supabase', 'migrations', '20261030000000_security_hardening.sql');
    expect(migration).toContain("extensions.digest(uid::text || ':' || pepper, 'sha256')");
  });
});

describe('Edge Function JWT verification is pinned in config, not left to deploy flags', () => {
  const config = read('supabase', 'config.toml').replace(/\r\n/g, '\n');

  it.each([
    ['delete-account', 'true'],
    ['audit-record', 'true'],
    // The Send-SMS hook is called by Supabase Auth with an HMAC signature, not a user JWT.
    ['send-sms-otp', 'false'],
  ])('%s has verify_jwt = %s', (fn, expected) => {
    expect(config).toContain(`[functions.${fn}]\nverify_jwt = ${expected}\n`);
  });
});
