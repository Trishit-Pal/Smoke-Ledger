import * as fs from 'fs';
import * as path from 'path';
import { redactText, redactRoute } from '../../supabase/functions/_shared/redact';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('redactText', () => {
  it.each([
    ['failed for jane.doe+x@example.co.in today', 'failed for [email] today'],
    ['call +91 98765 43210 now', 'call [phone] now'],
    ['phone 9876543210 bad', 'phone [phone] bad'],
    ['phone 415-555-0132 bad', 'phone [phone] bad'],
    ['phone (415) 555-0132 bad', 'phone [phone] bad'],
    ['+14155550132 rejected', '[phone] rejected'],
    ['user 3f2b8c1e-9a4d-4e6b-8f1a-2c7d5e9b0a13 missing', 'user [id] missing'],
    [`jwt ${JWT} expired`, 'jwt [token] expired'],
    ['Authorization: Bearer abc.def-123_xyz', 'Authorization: Bearer [token]'],
    ['key 5f4dcc3b5aa765d61d8327deb882cf99ab12 leaked', 'key [token] leaked'],
    ['order 4829175 not found', 'order [n] not found'],
  ])('redacts %s', (input, expected) => {
    expect(redactText(input)).toBe(expected);
  });

  it.each([
    'HTTP 500 at step 3',
    'Request failed with status code 404',
    'Network request failed',
    'retry 2 of 5 after 1500 ms',
    'duplicate key value violates unique constraint "logs_user_id_date_key"',
    'at 2026-11-03 10:20 row 12345',
  ])('leaves short numbers and plain text alone: %s', (input) => {
    expect(redactText(input)).toBe(input);
  });

  it('redacts before truncating so a cut token cannot leak a fragment', () => {
    const out = redactText(`${'x'.repeat(490)} a@example.com tail`, 500);
    expect(out).not.toContain('@');
    expect(out).toContain('[email]');
    expect(out.length).toBeLessThanOrEqual(500);
  });

  it('is idempotent', () => {
    const once = redactText('a@b.com 9876543210 4829175');
    expect(redactText(once)).toBe(once);
  });
});

describe('redaction cost', () => {
  it.each([['a-'.repeat(50000)], ['a.'.repeat(50000)], ['a'.repeat(100000)], ['1 '.repeat(50000)]])(
    'stays linear on pathological input (%#)',
    (input) => {
      const t0 = performance.now();
      redactText(input, 500);
      redactRoute(`/${input}`);
      expect(performance.now() - t0).toBeLessThan(200);
    },
  );
});

describe('redactRoute', () => {
  it('drops query strings and replaces numeric ids', () => {
    expect(redactRoute('/goals/1234567/edit?x=a@b.com')).toBe('/goals/:id/edit');
  });
  it('drops fragments and replaces uuids and tokens', () => {
    expect(redactRoute('/share/3f2b8c1e-9a4d-4e6b-8f1a-2c7d5e9b0a13#top')).toBe('/share/:id');
    expect(redactRoute(`/auth/${JWT}`)).toBe('/auth/:id');
    expect(redactRoute('/r/5f4dcc3b5aa765d61d8327deb882cf99ab12')).toBe('/r/:id');
  });
  it('treats segments with 6+ digits as dynamic', () => {
    expect(redactRoute('/call/98765-43210/log')).toBe('/call/:id/log');
  });
  it('redacts email path segments', () => {
    expect(redactRoute('/u/jane@example.com/profile')).toBe('/u/:id/profile');
  });
  it('keeps static routes and is bounded to 120 chars', () => {
    expect(redactRoute('/settings/privacy')).toBe('/settings/privacy');
    expect(redactRoute(`/${'a'.repeat(300)}`).length).toBeLessThanOrEqual(120);
  });
});

describe('edge writer', () => {
  it('delete-account redacts its error_events message through the shared module', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../supabase/functions/delete-account/index.ts'),
      'utf8',
    );
    expect(src).toContain("from '../_shared/redact.ts'");
    expect(src).toMatch(/message:\s*redactText\(/);
  });
});
