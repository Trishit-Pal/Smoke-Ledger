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

  it('web middleware sends / straight to /consent for outdated or missing consents', () => {
    expect(middleware).toContain('needsConsentRefresh(steps, true) ? CONSENT_ROUTE');
  });

  it('post-auth routing and the Expo entry points use the same check', () => {
    expect(read('web', 'lib', 'auth', 'postAuthDestination.ts')).toContain('consentGateRedirect(');
    expect(read('app', 'index.tsx')).toContain('needsConsentRefresh(profile, true)');
    // One mobile guard in the root layout covers every route, modals included.
    const root = read('app', '_layout.tsx');
    expect(root).toContain('routeGuardRedirect({');
    expect(root).toContain('router.replace(guardTarget');
    expect(root).toContain('isGuardLoading({');
    // The overlay's modal is iOS-only: the content hides from TalkBack while it shows.
    expect(root).toContain("importantForAccessibility={guardTarget ? 'no-hide-descendants' : 'auto'}");
    // ...and it is the only place: the tabs layout no longer repeats the checks.
    const tabs = read('app', '(tabs)', '_layout.tsx');
    expect(tabs).not.toMatch(/consentGateRedirect|resumeOnboardingRoute|<Redirect/);
    // After the not-onboarded redirect, so a mid-wizard user never reaches /consent.
    const guard = read('src', 'lib', 'routeGuard.ts');
    expect(guard).toContain('consentGateRedirect(pathname, profile, true');
    expect(guard.indexOf('resumeOnboardingRoute(profile)')).toBeLessThan(guard.indexOf('consentGateRedirect('));
  });

  it('the accept path writes no onboarding step', () => {
    const service = read('src', 'services', 'onboarding.ts');
    const start = service.indexOf('export async function acceptChangedTerms');
    const end = service.indexOf('/* ---------- Step 02');
    const body = service.slice(start, end);
    expect(body).not.toMatch(/onboardingStep|setOnboardingStep/);
  });

  it('both /consent screens ask for age and data-processing only when the profile has no record of them', () => {
    const web = read('web', 'app', 'consent', 'page.tsx');
    expect(web).toContain('needsAgeConfirm={!profile.ageConfirmedAt}');
    expect(web).toContain('needsDataProcessing={!profile.dataProcessingConsentAt}');
    for (const screen of [read('web', 'app', 'consent', 'ConsentClient.tsx'), read('app', 'consent.tsx')]) {
      expect(screen).toMatch(/acceptChangedTerms\(\{[^}]*needsAgeConfirm[^}]*needsDataProcessing/);
    }
    expect(read('app', 'consent.tsx')).toContain('needsAgeConfirm = !profile?.ageConfirmedAt');
  });

  it('both /consent screens choose the heading (and the changes list) by whether the terms changed', () => {
    expect(read('web', 'app', 'consent', 'page.tsx')).toContain('termsChanged={termsChanged(profile)}');
    expect(read('app', 'consent.tsx')).toContain('termsChanged(profile)');
    for (const screen of [read('web', 'app', 'consent', 'ConsentClient.tsx'), read('app', 'consent.tsx')]) {
      expect(screen).toContain('reconsentHeading(');
      expect(screen).not.toMatch(/\bRECONSENT_(TITLE|LEDE|CAPTION)\b/);
    }
  });

  it('the Expo onboarding layout never sends an onboarded reader to a wizard step', () => {
    // The root guard owns re-consent; the layout only moves an onboarded reader to the tabs.
    const layout = read('app', 'onboarding', '_layout.tsx').replace(/\r\n/g, '\n');
    const branch = layout.indexOf('if (profile.onboardedAt) {');
    expect(branch).toBeGreaterThan(-1);
    const body = layout.slice(branch, layout.indexOf('\n    }', branch));
    expect(body).toContain("router.replace('/(tabs)')");
    expect(body).toContain('return;');
    expect(body).not.toContain('/onboarding/privacy');
    expect(branch).toBeLessThan(layout.indexOf("router.replace('/onboarding/privacy')"));
  });
});
