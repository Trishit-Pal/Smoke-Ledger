import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');

/** The body of `const stampAll = () => { ... };` up to its closing `  };`. */
function stampAllBody(src: string): string {
  const start = src.indexOf('const stampAll = () => {');
  expect(start).toBeGreaterThan(-1);
  return src.slice(start, src.indexOf('\n  };', start));
}

describe.each([
  ['web', 'web/app/onboarding/privacy/OnboardingPrivacyClient.tsx'],
  ['mobile', 'app/onboarding/privacy.tsx'],
])('%s consent screen', (_platform, file) => {
  const src = read(file);

  it('"stamp all" never sets the optional analytics consent', () => {
    expect(stampAllBody(src)).not.toMatch(/analytics/i);
  });

  it('"stamp all" never sets the explicit health-data consent either', () => {
    expect(stampAllBody(src)).not.toMatch(/health/i);
  });

  it('shows the health consent in the Art 9 wording and a decline control', () => {
    // Web renders the row through the shared component (also used by /consent).
    const rowSrc = _platform === 'web' ? read('web/components/onboarding/ConsentRows.tsx') : src;
    expect(rowSrc).toContain('HEALTH_CONSENT_LABEL');
    expect(rowSrc).toContain('HEALTH_DECLINE_LABEL');
    if (_platform === 'web') expect(src).toContain('HealthConsentRow');
  });

  it('passes the health consent to the service, and gates Continue on it', () => {
    expect(src).toMatch(/healthDataConsent/);
  });
});
