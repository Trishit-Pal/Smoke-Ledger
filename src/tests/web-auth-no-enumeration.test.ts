/**
 * Regression guard: sign-in must not reveal whether an email has an account.
 *
 * Mirrors web-auth-login-hint-removed.test.ts. The earlier C3 fix removed the
 * login-hint endpoint for the same reason; bf62af4 reintroduced the leak through
 * a service-role lookup and "No ledger for this email." copy.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const read = (...parts: string[]): string =>
  fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');

describe('auth account enumeration (security regression guard)', () => {
  it('has no service-role email lookup module', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'web', 'lib', 'auth', 'authEmailExists.ts'))).toBe(
      false,
    );
  });

  it('the password sign-in action does not look the email up after a failure', () => {
    const action = read('web', 'app', '(auth)', 'login', 'actions.ts');
    expect(action).not.toMatch(/lookupAuthEmail|classifyInvalidCredentials|authEmailExists/);
  });

  it.each([
    ['web login page', ['web', 'app', '(auth)', 'login', 'page.tsx']],
    ['native login screen', ['app', '(auth)', 'login.tsx']],
  ])('%s treats an unknown email like a successful link send', (_label, parts) => {
    const source = read(...parts);
    expect(source).toContain('isUnknownEmailError');
    expect(source).not.toContain('No ledger for this email');
  });

  it('auth_email_exists is dropped from the database', () => {
    const migration = read('supabase', 'migrations', '20261030000000_security_hardening.sql');
    expect(migration).toMatch(/DROP FUNCTION IF EXISTS public\.auth_email_exists\(text\);/);
  });
});
