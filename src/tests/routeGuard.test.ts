import { LEGAL_VERSIONS } from '@/lib/legal';
import { isGuardLoading, routeGuardRedirect } from '@/lib/routeGuard';
import type { UserProfile } from '@/types';

const NOW = '2026-11-03T00:00:00.000Z';
const current = {
  ageConfirmedAt: NOW,
  termsVersion: LEGAL_VERSIONS.terms,
  privacyVersion: LEGAL_VERSIONS.privacy,
  healthDisclaimerVersion: LEGAL_VERSIONS.medicalDisclaimer,
  dataProcessingConsentAt: NOW,
  healthDataConsentAt: NOW,
};
const asProfile = (p: object) => p as unknown as UserProfile;

const ready = asProfile({ ...current, onboardedAt: NOW, onboardingStep: 'done' });
// Onboarded before health-data consent existed: the re-consent gate applies.
const outdated = asProfile({ ...current, onboardedAt: NOW, onboardingStep: 'done', healthDataConsentAt: null });
const midWizard = asProfile({ ...current, onboardedAt: null, onboardingStep: 'goal' });
const noConsent = asProfile({ onboardedAt: null, onboardingStep: 'usage' });

const guard = (pathname: string, profile: UserProfile | null, over: { session?: boolean; loading?: boolean } = {}) =>
  routeGuardRedirect({ pathname, hasSession: over.session ?? true, profile, loading: over.loading ?? false });

const MODALS = ['/log/new', '/goals/new', '/ask'];

describe('routeGuardRedirect', () => {
  it('does nothing while the session or profile is still loading', () => {
    expect(guard('/log/new', null, { session: false, loading: true })).toBeNull();
    expect(guard('/log/new', midWizard, { loading: true })).toBeNull();
  });

  describe('signed out', () => {
    it.each([...MODALS, '/', '/settings', '/history', '/consent', '/onboarding/usage'])('sends %s to /login', (p) => {
      expect(guard(p, null, { session: false })).toBe('/login');
    });
    it.each(['/login', '/signup', '/reset', '/auth/callback', '/auth/reset-password'])('leaves %s alone (no loop)', (p) => {
      expect(guard(p, null, { session: false })).toBeNull();
    });
  });

  it('lets a signed-in reader stay on auth routes (re-auth before deletion)', () => {
    expect(guard('/login', ready)).toBeNull();
    expect(guard('/auth/callback', midWizard)).toBeNull();
  });

  describe('not onboarded', () => {
    it.each([...MODALS, '/', '/settings', '/consent', '/goals', '/history'])('resumes the wizard from %s', (p) => {
      expect(guard(p, midWizard)).toBe('/onboarding/goal');
    });
    it('resumes at privacy until the consents exist', () => {
      expect(guard('/log/new', noConsent)).toBe('/onboarding/privacy');
    });
    it.each(['/onboarding/privacy', '/onboarding/goal', '/onboarding/done'])('leaves %s alone (no loop)', (p) => {
      expect(guard(p, midWizard)).toBeNull();
      expect(guard(p, noConsent)).toBeNull();
    });
  });

  describe('consent outdated', () => {
    it.each([...MODALS, '/', '/history', '/goals', '/trends'])('sends %s to /consent', (p) => {
      expect(guard(p, outdated)).toBe('/consent');
    });
    it.each(['/consent', '/settings', '/login', '/auth/reset-password'])('leaves %s alone (no loop)', (p) => {
      expect(guard(p, outdated)).toBeNull();
    });
  });

  describe('signed in, onboarded, consent current', () => {
    it.each([...MODALS, '/', '/history', '/settings'])('allows %s', (p) => {
      expect(guard(p, ready)).toBeNull();
    });
    it('moves a reader who is already current off /consent to the tabs', () => {
      expect(guard('/consent', ready)).toBe('/(tabs)');
    });
  });

  it('a signed-in reader with no profile row resumes onboarding, never reaches a modal', () => {
    expect(guard('/log/new', null)).toBe('/onboarding/privacy');
  });

  // An onboarded reader missing any one stamp (a legacy row) re-consents on /consent,
  // never in the wizard, from every path, and the destination is never redirected again.
  describe.each([
    'ageConfirmedAt',
    'termsVersion',
    'privacyVersion',
    'healthDisclaimerVersion',
    'dataProcessingConsentAt',
  ])('onboarded, missing %s', (key) => {
    const missing = asProfile({ ...current, onboardedAt: NOW, onboardingStep: 'done', [key]: null });
    it.each([...MODALS, '/', '/history', '/onboarding', '/onboarding/welcome', '/onboarding/privacy', '/onboarding/done'])(
      'sends %s to /consent',
      (p) => {
        expect(guard(p, missing)).toBe('/consent');
      },
    );
    it('leaves /consent and /settings alone (no loop)', () => {
      expect(guard('/consent', missing)).toBeNull();
      expect(guard('/settings', missing)).toBeNull();
    });
  });
});

describe('isGuardLoading', () => {
  const settled = { ready: true, fontsReady: true, hasError: false, authInitialized: true, hasSession: true, booted: true };

  it('is false only when the Stack is rendering and auth and profile are resolved', () => {
    expect(isGuardLoading(settled)).toBe(false);
  });
  it.each([
    ['boot not finished', { ready: false }],
    ['fonts still loading', { fontsReady: false }],
    ['error screen up', { hasError: true }],
    ['auth not initialised', { authInitialized: false }],
    ['signed in, profile not booted', { booted: false }],
  ])('is true while %s', (_n, over) => {
    expect(isGuardLoading({ ...settled, ...over })).toBe(true);
  });
  it('does not wait for a profile when signed out', () => {
    expect(isGuardLoading({ ...settled, hasSession: false, booted: false })).toBe(false);
  });
});
