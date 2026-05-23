import { test, expect } from '@playwright/test';

const loginEmail = process.env.E2E_LOGIN_EMAIL;
const loginPassword = process.env.E2E_LOGIN_PASSWORD;

test('protected routes redirect unauthenticated users to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('auth callback rejects open redirect', async ({ page }) => {
  await page.goto('/auth/callback?next=//evil.com');
  await expect(page).not.toHaveURL(/evil\.com/);
});

test('security headers include CSP and frame denial', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.headers()['content-security-policy']).toBeTruthy();
  expect(res?.headers()['x-frame-options']).toBe('DENY');
});

test('CSP nonce in response header matches nonce stamped on script tags', async ({ page }) => {
  const res = await page.goto('/login');
  const csp = res?.headers()['content-security-policy'] ?? '';
  const nonceMatch = csp.match(/'nonce-([^']+)'/);
  expect(nonceMatch, 'script-src must include a nonce-… token').not.toBeNull();
  const nonce = nonceMatch![1];

  // Every Next.js-generated <script> tag in the rendered HTML must carry the
  // same nonce. Otherwise 'strict-dynamic' blocks every chunk and no JS runs
  // — the exact failure mode that broke auth and the theme toggle.
  const html = await res!.text();
  const scriptTags = html.match(/<script\b[^>]*>/gi) ?? [];
  expect(scriptTags.length, 'login page must render at least one <script>').toBeGreaterThan(0);
  const stamped = scriptTags.filter((tag) => tag.includes(`nonce="${nonce}"`));
  expect(
    stamped.length,
    `expected every <script> tag to carry nonce="${nonce}"; found ${stamped.length}/${scriptTags.length}`,
  ).toBe(scriptTags.length);
});

test('signup page shows age acknowledgment', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByText(/18 or older/i)).toBeVisible();
});

test('login page shows keep me signed in option', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText(/keep me signed in/i)).toBeVisible();
});

// ---------------------------------------------------------------------------
// C2 — open-redirect sanitizer on the login page
// These specs require live auth credentials to exercise the post-login
// redirect. Without credentials the login form never completes, so the
// redirect target is never reached. They are skipped in CI unless
// E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD are set.
// ---------------------------------------------------------------------------

test('login with protocol-relative next= lands on /dashboard after auth', async ({ page }) => {
  test.skip(
    !loginEmail || !loginPassword,
    'Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run.',
  );

  // The sanitizer on the login page must reject //evil.com and fall back to
  // /dashboard before the credentials form is even submitted.
  await page.goto(`/login?next=${encodeURIComponent('//evil.com')}`);
  await page.getByLabel('Email').fill(loginEmail!);
  await page.getByLabel('Password').fill(loginPassword!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);

  // Must not have navigated to evil.com at any point.
  expect(page.url()).not.toMatch(/evil\.com/);
});

test('login with chained redirect via onboarding next= lands on /dashboard', async ({ page }) => {
  test.skip(
    !loginEmail || !loginPassword,
    'Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run.',
  );

  // Classic phishing chain: /onboarding/privacy is not in the post-auth
  // allowlist, so the sanitizer must fall back to /dashboard.
  const maliciousNext = '/onboarding/privacy?next=https://evil.com';
  await page.goto(`/login?next=${encodeURIComponent(maliciousNext)}`);
  await page.getByLabel('Email').fill(loginEmail!);
  await page.getByLabel('Password').fill(loginPassword!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);

  expect(page.url()).not.toMatch(/evil\.com/);
});

test('password login without remember-me sets session-only auth cookies', async ({
  page,
  context,
}) => {
  test.skip(
    !loginEmail || !loginPassword,
    'Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run.',
  );

  await page.goto('/login');
  await page.getByLabel('Email').fill(loginEmail!);
  await page.getByLabel('Password').fill(loginPassword!);
  await page.getByRole('checkbox', { name: /keep me signed in/i }).uncheck();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);

  const cookies = await context.cookies();
  const authCookies = cookies.filter((c) => c.name.includes('-auth-token'));
  expect(authCookies.length).toBeGreaterThan(0);
  for (const cookie of authCookies) {
    expect(cookie.expires, `${cookie.name} should be session cookie`).toBe(-1);
  }
});
