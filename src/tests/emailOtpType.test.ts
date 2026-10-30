import * as fs from 'fs';
import * as path from 'path';
import { parseEmailOtpType } from '@/lib/emailOtpType';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const read = (...parts: string[]): string =>
  fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');

describe('parseEmailOtpType', () => {
  it.each(['signup', 'recovery', 'magiclink', 'email'])('accepts %s', (type) => {
    expect(parseEmailOtpType(type)).toBe(type);
  });

  it.each(['invite', 'email_change', 'sms', '', 'RECOVERY', '__proto__', 'constructor'])(
    'rejects %j',
    (type) => {
      expect(parseEmailOtpType(type)).toBeNull();
    },
  );

  it('rejects a missing value', () => {
    expect(parseEmailOtpType(null)).toBeNull();
    expect(parseEmailOtpType(undefined)).toBeNull();
  });
});

describe('verifyOtp callers go through the allowlist', () => {
  it.each([
    ['web callback route', ['web', 'app', 'auth', 'callback', 'route.ts']],
    ['native deep-link handler', ['src', 'lib', 'authCallback.ts']],
  ])('%s parses type with parseEmailOtpType and never casts it', (_label, parts) => {
    const source = read(...parts);
    expect(source).toContain('parseEmailOtpType');
    expect(source).not.toMatch(/as EmailOtpType|type as '/);
  });
});
