/**
 * Review fix for security scan F2. The delete-account gate now requires a fresh
 * sign-in on the presenting session, and on reauth_required both clients send
 * the still-signed-in user to `/login?…reason=reauth`. But web middleware
 * bounced every signed-in visitor off /login to /dashboard, and the mobile
 * (auth) layout redirected any session to `/`, so the fresh sign-in could never
 * happen and account deletion (the DPDP erasure path) was unreachable.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ACCOUNT_DELETED_PARAM, DELETE_RESUME_PATH, isReauthRequest } from '@/lib/reauth';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (...parts: string[]): string =>
  fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');

describe('isReauthRequest', () => {
  it('is true only for /login with reason=reauth', () => {
    expect(isReauthRequest('/login', 'reauth')).toBe(true);
  });

  it.each([
    ['/login', null],
    ['/login', 'expired'],
    ['/signup', 'reauth'],
    ['/reset', 'reauth'],
    ['/login/', 'reauth'],
    ['/dashboard', 'reauth'],
  ])('is false for %j with reason %j', (pathname, reason) => {
    expect(isReauthRequest(pathname, reason)).toBe(false);
  });
});

describe('a signed-in user can reach the re-auth sign-in', () => {
  it('web middleware lets reason=reauth through before bouncing signed-in users off auth routes', () => {
    const middleware = read('web', 'middleware.ts');
    const reauthAt = middleware.indexOf("isReauthRequest(pathname, url.searchParams.get('reason'))");
    const bounceAt = middleware.indexOf("NextResponse.redirect(new URL('/dashboard', request.url))");
    expect(reauthAt).toBeGreaterThan(-1);
    expect(bounceAt).toBeGreaterThan(-1);
    expect(reauthAt).toBeLessThan(bounceAt);
  });

  it('the mobile auth layout does not redirect a session away from a reauth sign-in', () => {
    const layout = read('app', '(auth)', '_layout.tsx');
    expect(layout).toContain('isReauthRequest(pathname, reason)');
    expect(layout).toMatch(/if \(session && !isReauthRequest\(pathname, reason\)\)/);
  });
});

/**
 * The re-auth detour must FINISH the deletion, or say plainly that it did not.
 * Before this, mobile sent the user to a plain sign-in and then Home: the
 * account was never deleted but it looked exactly like a successful deletion,
 * so the same email + password kept working.
 */
describe('the re-auth detour resumes the pending deletion on both platforms', () => {
  const webSettings = read('web', 'app', '(app)', 'settings', 'SettingsClient.tsx');
  const mobileSettings = read('app', '(tabs)', 'settings.tsx');
  const mobileLogin = read('app', '(auth)', 'login.tsx');

  it('shares one resume path and one deleted flag', () => {
    expect(DELETE_RESUME_PATH).toBe('/settings?action=delete');
    expect(ACCOUNT_DELETED_PARAM).toBe('deleted');
    expect(webSettings).toContain('DELETE_RESUME_PATH');
    expect(mobileLogin).toContain('DELETE_RESUME_PATH');
    expect(mobileLogin).toContain('ACCOUNT_DELETED_PARAM');
    expect(mobileSettings).toContain('ACCOUNT_DELETED_PARAM');
  });

  it('mobile login reads the reauth reason, says why, and returns to Settings to re-confirm', () => {
    expect(mobileLogin).toMatch(/useLocalSearchParams</);
    expect(mobileLogin).toContain("reason === 'reauth'");
    expect(mobileLogin).toContain('Confirm it’s you to finish deleting your account.');
    expect(mobileLogin).toMatch(/router\.replace\(reason === 'reauth' \? DELETE_RESUME_PATH : '\/'\)/);
  });

  it('mobile Settings resumes from ?action=delete with a distinct confirmation', () => {
    expect(mobileSettings).toMatch(/useLocalSearchParams</);
    expect(mobileSettings).toMatch(/action [!=]== 'delete'/);
    expect(mobileSettings).toContain("deleteAccount('resume')");
    expect(mobileSettings).toContain('Signed in again. Delete your account now?');
  });

  it('web detects the detour by flag, not by sniffing authentication_error', () => {
    const start = webSettings.indexOf('const onDeleteAccount = async (resume = false) => {');
    expect(start).toBeGreaterThan(-1);
    const handler = webSettings.slice(start, webSettings.indexOf('// ── Derived profile', start));
    expect(handler).toContain('isReauthRedirect = true;');
    expect(handler).not.toContain("e.code === 'authentication_error'");
    // The resume confirmation never redirects again (no silent login ↔ Settings loop).
    expect(handler).toMatch(/onReauthRequired: resume\s*\?\s*undefined/);
    expect(webSettings).toContain("'delete-resume'");
    expect(webSettings).toContain('Signed in again. Delete your account now?');
  });

  it('both platforms warn about the sign-in step up front and admit when nothing was deleted', () => {
    for (const src of [webSettings, mobileSettings]) {
      expect(src).toContain('You may be asked to sign in again before anything is deleted.');
      expect(src).toContain('Your account has not been deleted.');
    }
  });

  it('mobile shows the deleted notice once on the login screen; web keeps its landing banner', () => {
    expect(mobileSettings).toContain("router.replace(`/login?${ACCOUNT_DELETED_PARAM}=1`)");
    expect(mobileLogin).toContain('Your account and all its data have been deleted.');
    expect(webSettings).toContain('router.replace(`/?${ACCOUNT_DELETED_PARAM}=1`)');
  });
});

/** Review follow-ups (2026-11-02): each guard pins one fix so it cannot regress silently. */
describe('review follow-ups', () => {
  const webSettings = read('web', 'app', '(app)', 'settings', 'SettingsClient.tsx');
  const notice = read('web', 'components', 'marketing', 'AccountDeletedNotice.tsx');
  const mobileLogin = read('app', '(auth)', 'login.tsx');
  const webLogin = read('web', 'app', '(auth)', 'login', 'page.tsx');
  const goalClients = [
    read('app', 'onboarding', 'goal.tsx'),
    read('web', 'app', 'onboarding', 'goal', 'OnboardingGoalClient.tsx'),
  ];
  const usagePages = [
    read('app', 'onboarding', 'usage.tsx'),
    read('web', 'app', 'onboarding', 'usage', 'page.tsx'),
  ];
  const privacyClients = [
    read('app', 'onboarding', 'privacy.tsx'),
    read('web', 'app', 'onboarding', 'privacy', 'OnboardingPrivacyClient.tsx'),
  ];

  it('the deleted flag comes from ACCOUNT_DELETED_PARAM everywhere on web', () => {
    expect(webSettings).toContain('router.replace(`/?${ACCOUNT_DELETED_PARAM}=1`)');
    expect(webSettings).not.toContain("'/?deleted=1'");
    expect(notice).toContain('params.get(ACCOUNT_DELETED_PARAM)');
  });

  it('the re-auth warning is terracotta on both platforms, never the positive accent', () => {
    expect(mobileLogin).toMatch(/color=\{theme\.warnEarth\}[^>]*>\s*Confirm it’s you/);
    expect(webLogin).toContain('<InlineInfo tone="warn" message="Confirm it');
    expect(webLogin).toContain("tone === 'warn' ? 'var(--warn-earth)'");
  });

  it('goal clients use describeError and re-read the goal after a failed submit', () => {
    for (const src of goalClients) {
      expect(src).not.toContain('errorCopy');
      expect(src).toContain("describeError(e, 'dependency_failure')");
      expect(src).toMatch(/await loadGoalStep\(\)\s*\.then\(\(d\) => setExisting\(d\.existing\)\)/);
    }
  });

  it('usage hydration re-checks the draft when the load resolves (edits in flight win)', () => {
    for (const src of usagePages) {
      expect(src).toContain('isUsageDraftEmpty()');
    }
  });

  it('web usage saves the country before advancing the step', () => {
    const page = usagePages[1];
    expect(page.indexOf('await setRegion(country)')).toBeGreaterThan(-1);
    expect(page.indexOf('await setRegion(country)')).toBeLessThan(
      page.indexOf('await submitUsageStep('),
    );
    // A saved country is remembered so a retry does not re-run set_region.
    expect(page).toMatch(/await setRegion\(country\);\s*setSavedCountry\(country\);/);
  });

  it('privacy retries after a saved consent never re-audit', () => {
    for (const src of privacyClients) {
      expect(src).toContain('alreadyConsented: savedRef.current ||');
      expect(src).toContain('savedRef.current = true;');
    }
  });
});
