/**
 * Password and phone-OTP sign-in must land where the consent/onboarding gate
 * says. A server-action redirect('/dashboard') makes Next follow the middleware's
 * 307 silently, so an outdated-consent reader saw /consent content under
 * /dashboard. The actions now redirect straight to postAuthDestination's answer.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { resolvePostSignInPath } from '../../web/lib/auth/signInDestination';

const CONSENTED = {
  age_confirmed_at: 't',
  terms_version: LEGAL_VERSIONS.terms,
  privacy_version: LEGAL_VERSIONS.privacy,
  health_disclaimer_version: LEGAL_VERSIONS.medicalDisclaimer,
  data_processing_consent_at: 't',
  health_data_consent_at: 't',
};
const ONBOARDED = { ...CONSENTED, onboarded_at: 't' };

function clientReturning(result: { data: unknown; error: unknown }) {
  const select = jest.fn();
  const eq = jest.fn();
  const query = { select, eq, maybeSingle: jest.fn().mockResolvedValue(result) };
  select.mockReturnValue(query);
  eq.mockReturnValue(query);
  const from = jest.fn().mockReturnValue(query);
  return { client: { from } as never, from, select, eq };
}

describe('resolvePostSignInPath', () => {
  it('reads the signed-in reader own profile row', async () => {
    const { client, from, select, eq } = clientReturning({ data: ONBOARDED, error: null });
    await resolvePostSignInPath(client, 'user-1', null);
    expect(from).toHaveBeenCalledWith('user_profiles');
    expect(select.mock.calls[0][0]).toContain('health_data_consent_at');
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('sends an onboarded reader with outdated consents to /consent', async () => {
    const { client } = clientReturning({
      data: { ...ONBOARDED, terms_version: '2020-01-01' },
      error: null,
    });
    expect(await resolvePostSignInPath(client, 'u', null)).toBe('/consent');
  });

  it('sends an onboarded reader with a missing stamp to /consent', async () => {
    const { client } = clientReturning({
      data: { ...ONBOARDED, health_data_consent_at: null },
      error: null,
    });
    expect(await resolvePostSignInPath(client, 'u', '/log')).toBe('/consent');
  });

  it('sends a reader who is not onboarded to the privacy step', async () => {
    const { client } = clientReturning({ data: null, error: null });
    expect(await resolvePostSignInPath(client, 'u', null)).toBe('/onboarding/privacy');
  });

  it('resumes a consented mid-wizard reader at the saved step', async () => {
    const { client } = clientReturning({
      data: { ...CONSENTED, onboarding_step: 'goal' },
      error: null,
    });
    expect(await resolvePostSignInPath(client, 'u', null)).toBe('/onboarding/goal');
  });

  it('honours the requested next, else the dashboard, when consents are current', async () => {
    const { client } = clientReturning({ data: ONBOARDED, error: null });
    expect(await resolvePostSignInPath(client, 'u', '/log?ref=widget')).toBe('/log?ref=widget');
    expect(await resolvePostSignInPath(client, 'u', null)).toBe('/dashboard');
  });

  it('on a profile read error falls back to next or /dashboard, never onboarding', async () => {
    const { client } = clientReturning({ data: null, error: { code: '57014' } });
    expect(await resolvePostSignInPath(client, 'u', '/history')).toBe('/history');
    expect(await resolvePostSignInPath(client, 'u', null)).toBe('/dashboard');
  });
});

describe('sign-in actions use the shared destination', () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, '../../web/app/(auth)/login', rel), 'utf8');

  it.each(['actions.ts', '_actions/phoneOtp.ts'])('%s redirects via resolvePostSignInPath', (file) => {
    const src = read(file);
    expect(src).toContain('resolvePostSignInPath(');
    expect(src).not.toMatch(/redirect\(nextPath/);
  });
});
