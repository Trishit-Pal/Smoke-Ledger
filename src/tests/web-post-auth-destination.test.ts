/**
 * Where a freshly signed-in browser goes. This was inline in the callback
 * route; it is now shared by the callback (PKCE code) and the confirm page's
 * server action (token_hash), so the two paths cannot drift.
 */
import { postAuthDestination } from '../../web/lib/auth/postAuthDestination';

const CONSENTED = {
  age_confirmed_at: 't',
  terms_version: '1',
  privacy_version: '1',
  health_disclaimer_version: '1',
  data_processing_consent_at: 't',
};
const ONBOARDED = { ...CONSENTED, onboarded_at: 't' };

describe('postAuthDestination', () => {
  it('sends a recovery link to set a new password, even before consents', () => {
    expect(postAuthDestination(null, 'recovery', null)).toBe('/reset-password');
    expect(postAuthDestination(null, null, '/reset-password?hint=x')).toBe('/reset-password?hint=x');
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
    expect(postAuthDestination(CONSENTED, null, '/log')).toBe('/onboarding/privacy');
  });

  it('honours next for an onboarded user, else the dashboard', () => {
    expect(postAuthDestination(ONBOARDED, 'magiclink', '/log?ref=widget')).toBe('/log?ref=widget');
    expect(postAuthDestination(ONBOARDED, 'magiclink', null)).toBe('/dashboard');
  });
});
