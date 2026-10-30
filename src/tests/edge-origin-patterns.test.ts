import * as fs from 'fs';
import * as path from 'path';
import { PREVIEW_ORIGIN_REGEX } from '../../supabase/functions/_shared/originPatterns';

describe('Edge Function preview-origin allowlist', () => {
  it.each([
    'https://smoke-ledger-trishitworks-projects.vercel.app',
    'https://smoke-ledger-git-main-trishitworks-projects.vercel.app',
    'https://smoke-ledger-ed9gras8y-trishitworks-projects.vercel.app',
    'https://smoke-ledger-git-feat-eur-eu-country-ledger-trishitworks-projects.vercel.app',
  ])('accepts this project\'s own deployment %s', (origin) => {
    expect(PREVIEW_ORIGIN_REGEX.test(origin)).toBe(true);
  });

  it.each([
    'https://attacker.vercel.app',
    'https://smoke-ledger.evil.vercel.app',
    'https://evil-smoke-ledger-trishitworks-projects.vercel.app',
    'https://smoke-ledger-x-trishitworks-projects.vercel.app.evil.com',
    'http://smoke-ledger-trishitworks-projects.vercel.app',
    'https://smoke-ledger-other-team-projects.vercel.app',
  ])('rejects %s', (origin) => {
    expect(PREVIEW_ORIGIN_REGEX.test(origin)).toBe(false);
  });

  it('cors.ts uses the scoped pattern, not a wildcard *.vercel.app regex', () => {
    const cors = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/functions/_shared/cors.ts'),
      'utf8',
    );
    expect(cors).toContain('PREVIEW_ORIGIN_REGEX');
    expect(cors).not.toMatch(/\[a-z0-9-\]\+\\\.vercel\\\.app/);
  });
});
