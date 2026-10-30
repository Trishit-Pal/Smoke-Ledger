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
  it('readAuthLink, the shared link classifier, parses type with parseEmailOtpType', () => {
    expect(read('src', 'lib', 'authLink.ts')).toContain('parseEmailOtpType(');
  });

  // Every verifyOtp caller takes its type from readAuthLink, never from a cast.
  it.each([
    ['web confirm action', ['web', 'app', 'auth', 'confirm', 'actions.ts']],
    ['native deep-link handler', ['src', 'lib', 'authCallback.ts']],
  ])('%s classifies with readAuthLink and never casts the type', (_label, parts) => {
    const source = read(...parts);
    expect(source).toContain('readAuthLink(');
    expect(source).not.toMatch(/as EmailOtpType|type as '/);
  });
});
