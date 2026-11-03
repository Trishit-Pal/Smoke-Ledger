import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Source-level proof that every surface routes through the one gate and that the
// gate sits where it must (jest cannot mount the Expo layout or run the middleware).
const read = (...p: string[]) => readFileSync(join(__dirname, '..', '..', ...p), 'utf8');

describe('re-consent gate wiring', () => {
  const middleware = read('web', 'middleware.ts');

  it('web middleware selects health_data_consent_at and runs the gate before the onboarded bounce', () => {
    expect(middleware).toContain('health_data_consent_at');
    const gate = middleware.indexOf('consentGateRedirect(');
    const bounce = middleware.indexOf("if (onboarded && isOnboardingRoute(pathname))");
    expect(gate).toBeGreaterThan(-1);
    expect(bounce).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(bounce);
  });

  it('web middleware sends / straight to /consent for outdated consents', () => {
    expect(middleware).toMatch(/consentsOutdated\(steps\) \? CONSENT_ROUTE/);
  });

  it('post-auth routing and the Expo entry points use the same check', () => {
    expect(read('web', 'lib', 'auth', 'postAuthDestination.ts')).toContain('consentsOutdated(steps)');
    expect(read('app', 'index.tsx')).toContain('consentsOutdated(profile)');
    const tabs = read('app', '(tabs)', '_layout.tsx');
    expect(tabs).toContain('consentGateRedirect(pathname, profile, true)');
    // After the not-onboarded redirect, so a mid-wizard user never reaches /consent.
    expect(tabs.indexOf('resumeOnboardingRoute(profile)')).toBeLessThan(tabs.indexOf('consentGateRedirect('));
  });

  it('the accept path writes no onboarding step', () => {
    const service = read('src', 'services', 'onboarding.ts');
    const start = service.indexOf('export async function acceptChangedTerms');
    const end = service.indexOf('/* ---------- Step 02');
    const body = service.slice(start, end);
    expect(body).not.toMatch(/onboardingStep|setOnboardingStep/);
  });
});
