/**
 * Where a freshly signed-in browser goes. This was inline in the callback
 * route; it is now shared by the callback (PKCE code) and the confirm page's
 * server action (token_hash), so the two paths cannot drift.
 */
import { LEGAL_VERSIONS } from '@/lib/legal';
import { nextPathForLink, postAuthDestination } from '../../web/lib/auth/postAuthDestination';

const CONSENTED = {
  age_confirmed_at: 't',
  terms_version: LEGAL_VERSIONS.terms,
  privacy_version: LEGAL_VERSIONS.privacy,
  health_disclaimer_version: LEGAL_VERSIONS.medicalDisclaimer,
  data_processing_consent_at: 't',
  health_data_consent_at: 't',
};
const ONBOARDED = { ...CONSENTED, onboarded_at: 't' };

describe('postAuthDestination', () => {
  it('sends an explicit /reset-password next there, even before consents', () => {
    expect(postAuthDestination(null, null, '/reset-password?hint=x')).toBe('/reset-password?hint=x');
  });

  // Review fix (M3): the old callback only defaulted a recovery link to
  // /reset-password on the token_hash path. A bare `type=recovery` on a PKCE code
  // link, or on its own, must not force a signed-in user there.
  it('does not invent a reset destination from type alone', () => {
    expect(postAuthDestination(null, 'recovery', null)).toBe('/onboarding/privacy');
  });

  it('sends a user without the required consents to the privacy step', () => {
    expect(postAuthDestination(null, 'magiclink', '/log')).toBe('/onboarding/privacy');
    expect(postAuthDestination({ ...CONSENTED, terms_version: null }, null, '/log')).toBe(
      '/onboarding/privacy',
    );
  });

  it('flags a first-time signup confirmation for the welcome celebration', () => {
    expect(postAuthDestination(null, 'signup', null)).toBe('/onboarding/privacy?welcome=1');
  });

  it('lets a consented but not onboarded user continue to an onboarding step only', () => {
    expect(postAuthDestination(CONSENTED, null, '/onboarding/goal')).toBe('/onboarding/goal');
    // A non-onboarding next resumes the wizard at the saved step — never back at
    // consent (a legacy row with no step resumes at usage).
    expect(postAuthDestination(CONSENTED, null, '/log')).toBe('/onboarding/usage');
    expect(postAuthDestination({ ...CONSENTED, onboarding_step: 'goal' }, null, '/log')).toBe(
      '/onboarding/goal',
    );
    expect(postAuthDestination({ ...CONSENTED, onboarding_step: 'brands' }, null, null)).toBe(
      '/onboarding/brands',
    );
  });

  it('honours next for an onboarded user, else the dashboard', () => {
    expect(postAuthDestination(ONBOARDED, 'magiclink', '/log?ref=widget')).toBe('/log?ref=widget');
    expect(postAuthDestination(ONBOARDED, 'magiclink', null)).toBe('/dashboard');
  });
});

describe('postAuthDestination re-consent', () => {
  it('sends an onboarded user with older versions or no health consent to /consent, ahead of next', () => {
    expect(postAuthDestination({ ...ONBOARDED, terms_version: '2020-01-01' }, null, '/log')).toBe('/consent');
    expect(postAuthDestination({ ...ONBOARDED, health_data_consent_at: null }, 'magiclink', null)).toBe(
      '/consent',
    );
  });

  it('honours an exempt next (the /settings delete-resume) instead of detouring through /consent', () => {
    const next = '/settings?resume=delete';
    expect(postAuthDestination({ ...ONBOARDED, health_data_consent_at: null }, 'magiclink', next)).toBe(next);
    expect(postAuthDestination({ ...ONBOARDED, terms_version: '2020-01-01' }, null, '/privacy')).toBe('/privacy');
  });

  it('still lets recovery through, and leaves a mid-wizard user in the wizard', () => {
    expect(
      postAuthDestination({ ...ONBOARDED, health_data_consent_at: null }, null, '/reset-password'),
    ).toBe('/reset-password');
    expect(
      postAuthDestination({ ...CONSENTED, health_data_consent_at: null, onboarding_step: 'goal' }, null, null),
    ).toBe('/onboarding/goal');
  });
});

// Every stamp the gates read, snake_case as the callback selects them.
const STAMPS = [
  'age_confirmed_at',
  'terms_version',
  'privacy_version',
  'health_disclaimer_version',
  'data_processing_consent_at',
  'health_data_consent_at',
] as const;

describe('postAuthDestination decision table: an existing reader never lands in the wizard', () => {
  const NEXTS = [null, '/log', '/onboarding', '/onboarding/privacy', '/onboarding/goal'];
  const EXEMPT_NEXTS = ['/settings?resume=delete', '/privacy', '/reset-password'];

  it.each(STAMPS)('onboarded, missing %s: /consent ahead of any next, never an onboarding step', (key) => {
    const profile = { ...ONBOARDED, [key]: null };
    for (const type of [null, 'magiclink', 'signup'] as const) {
      for (const next of NEXTS) {
        expect([type, next, postAuthDestination(profile, type, next)]).toEqual([type, next, '/consent']);
      }
      // An exempt next (delete-resume, legal pages, recovery) is honoured, as for outdated consents.
      for (const next of EXEMPT_NEXTS) expect(postAuthDestination(profile, type, next)).toBe(next);
    }
  });

  it('onboarded and current: an onboarding next falls back to the dashboard', () => {
    for (const next of ['/onboarding', '/onboarding/privacy', '/onboarding/goal']) {
      expect(postAuthDestination(ONBOARDED, 'magiclink', next)).toBe('/dashboard');
    }
    expect(postAuthDestination(ONBOARDED, null, '/settings?resume=delete')).toBe('/settings?resume=delete');
  });

  it.each(STAMPS.filter((k) => k !== 'health_data_consent_at'))(
    'not onboarded, missing %s: the privacy step (with the signup welcome) as before',
    (key) => {
      const profile = { ...CONSENTED, onboarding_step: 'goal', [key]: null };
      expect(postAuthDestination(profile, null, '/log')).toBe('/onboarding/privacy');
      expect(postAuthDestination(profile, 'signup', null)).toBe('/onboarding/privacy?welcome=1');
    },
  );
});

describe('nextPathForLink (token_hash links only)', () => {
  it('defaults a recovery link to /reset-password', () => {
    expect(nextPathForLink('recovery', null)).toBe('/reset-password');
  });

  it('keeps an explicit next', () => {
    expect(nextPathForLink('recovery', '/reset-password?hint=x')).toBe('/reset-password?hint=x');
    expect(nextPathForLink('magiclink', '/log')).toBe('/log');
  });

  it('adds nothing for other link types', () => {
    expect(nextPathForLink('magiclink', null)).toBeNull();
    expect(nextPathForLink('signup', null)).toBeNull();
  });
});
