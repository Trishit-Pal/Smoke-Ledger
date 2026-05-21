/**
 * Regression guard: login-hint endpoint must NOT exist.
 *
 * The route was deleted in the C3 security fix (account enumeration).
 * This test prevents accidental re-introduction of the file.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LOGIN_HINT_ROUTE = path.join(
  REPO_ROOT,
  'web',
  'app',
  'api',
  'auth',
  'login-hint',
  'route.ts',
);

describe('login-hint endpoint removal (security regression guard)', () => {
  it('web/app/api/auth/login-hint/route.ts does not exist', () => {
    expect(fs.existsSync(LOGIN_HINT_ROUTE)).toBe(false);
  });
});
