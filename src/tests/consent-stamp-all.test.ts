import * as healthConsent from '../lib/healthConsent';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');

/** The body of `const stampAll = ...` up to the next top-level handler. */
function stampAllBody(src: string): string {
  const start = src.indexOf('const stampAll =');
  expect(start).toBeGreaterThan(-1);
  return src.slice(start, src.indexOf('\n  const onContinue', start));
}

describe.each([
  ['web', 'web/app/onboarding/privacy/OnboardingPrivacyClient.tsx'],
  ['mobile', 'app/onboarding/privacy.tsx'],
])('%s consent screen', (platform, file) => {
  const src = read(file);

  it('"stamp all" never sets the optional analytics consent', () => {
    expect(stampAllBody(src)).not.toMatch(/analytics/i);
  });

  it('"stamp all" never sets the explicit health-data consent or the chat choice either', () => {
    expect(stampAllBody(src)).not.toMatch(/health/i);
    expect(stampAllBody(src)).not.toMatch(/chat/i);
  });

  it('shows the agreement row and the health consent in the Art 9 wording, with no decline', () => {
    // Both platforms render the rows through a shared component (also used by /consent).
    const rowSrc = read(
      platform === 'web' ? 'web/components/onboarding/ConsentRows.tsx' : 'src/components/consent/ConsentRows.tsx',
    );
    expect(rowSrc).toContain('HEALTH_CONSENT_LABEL');
    expect(rowSrc).toContain('AGREEMENT_LABEL_PARTS');
    expect(rowSrc).not.toMatch(/consent\.? ?decline|I don't consent/i);
    expect(src).toContain('<AgreementRow');
    expect(src).toContain('<HealthConsentRow');
  });

  it('passes the health consent to the service, and gates Continue on it', () => {
    expect(src).toMatch(/healthDataConsent/);
    expect(src).toContain('canContinueConsent(');
  });
});

describe('the health-consent decline is gone', () => {
  it('healthConsent exports the consent copy and no decline copy', () => {
    expect(healthConsent.HEALTH_CONSENT_LABEL).toBeTruthy();
    expect(Object.keys(healthConsent).filter((k) => /DECLINE/.test(k))).toEqual([]);
  });

  it('/consent keeps the way out to Settings on both platforms', () => {
    expect(read('app/consent.tsx')).toContain('RECONSENT_NOT_NOW_LABEL');
    expect(read('web/app/consent/ConsentClient.tsx')).toContain('RECONSENT_NOT_NOW_LABEL');
  });
});
