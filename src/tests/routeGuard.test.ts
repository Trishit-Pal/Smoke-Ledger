import { LEGAL_VERSIONS } from '@/lib/legal';
import { routeGuardRedirect } from '@/lib/routeGuard';
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

  it('a not-yet-loaded profile for a signed-in reader resumes onboarding, never reaches a modal', () => {
    expect(guard('/log/new', null)).toBe('/onboarding/privacy');
  });
});
