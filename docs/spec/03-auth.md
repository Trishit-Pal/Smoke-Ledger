---
section: auth
sources:
  - src/lib/authCallback.ts
  - src/tests/authCallback.test.ts
  - src/store/auth.ts
  - src/lib/auth-errors.ts
  - src/tests/auth-errors.test.ts
  - src/tests/web-auth-redirect.test.ts
  - src/tests/web-auth-callback-sanitize.test.ts
  - src/tests/web-auth-rate-limit-keys.test.ts
  - src/tests/web-auth-timeout.test.ts
  - app/auth/callback.tsx
  - app/auth/reset-password.tsx
  - app/(auth)/_layout.tsx
  - app/(auth)/login.tsx
  - app/(auth)/signup.tsx
  - app/(auth)/reset.tsx
  - web/app/auth/callback/route.ts
  - web/app/(auth)/login/page.tsx
  - web/app/(auth)/login/actions.ts
  - web/app/(auth)/login/_actions/phoneOtp.ts
  - web/app/(auth)/signup/page.tsx
  - web/app/(auth)/reset/page.tsx
  - web/app/(auth)/reset-password/page.tsx
  - web/app/(auth)/_actions/authPrechecks.ts
  - web/lib/auth/authCatch.ts
  - web/lib/auth/authRateLimitKeys.ts
  - docs/architecture/oauth-csrf.md
  - docs/deployment/auth-email-delivery.md
  - DB: public.handle_new_user (trigger)
  - DB: public.enforce_profile_identity_rules (trigger)
  - DB: public.user_profiles (schema — Supabase project tvcwrsglceahkjnfuzkn)
last_verified_commit: fcabb85
status: current
---

# Authentication

## Purpose

Authentication lets users create an account, prove who they are, and recover access when they forget their password. Because Smoke Ledger stores personal health data, getting auth right also means the system must stay out of the way: no session cookie in a redirected URL, no raw error message on screen, no link that only works on the device where you clicked "forgot password".

## What the user experiences

**Signing up.** On mobile, the user fills in their name, date of birth, gender, email, and a password (8–128 characters), confirms it, and taps "Create account". On web, there is an additional acknowledgement checkbox — "I am 18 or older and understand the next step will ask me to review and accept the Terms, Privacy Policy, and medical disclaimer." Either way, if email confirmation is enabled, the form flips to a "check your email" state with a resend button. There is no immediate app access until the link is clicked. Alternatively, on web, the user can tap "Sign up with email link instead" to skip setting a password and receive a one-click link that creates and confirms the account in one step.

**Signing in.** Both platforms offer two modes, selectable from a toggle: **Password** (email + password) and **Email link** (magic link). The web login page also shows a **Phone OTP** mode when `NEXT_PUBLIC_PHONE_OTP_ENABLED` is set. The email-link mode sends a one-click sign-in link to an existing account; it does not create new accounts (`shouldCreateUser: false`). The info message after sending is always neutral — "If that email is registered, a sign-in link is on its way" — to avoid revealing whether an email is registered.

**Password reset.** A "Forgot password?" link on the login screen opens a separate page. The user enters their email and taps send. The success message is neutral regardless of whether the address exists ("If an account exists for that email, a reset link is on its way"). Clicking the link lands the user on a "choose a new password" form. After updating, the app shows a brief confetti/celebration moment, then signs the user out automatically and redirects them to sign in with the new password.

**What a first-time user sees after confirming their email.** After clicking the confirmation link, the app (or web callback) detects that this is a brand-new signup and sets a `justCreated` flag (mobile) or appends `?welcome=1` to the onboarding URL (web). The onboarding flow then fires the account-created celebration before proceeding to consent collection. The celebration is a one-shot — it never fires again.

**Session persistence.** On web, the "Keep me signed in on this device" checkbox controls session lifetime. Without it, the auth cookie is session-scoped (gone when the browser closes). On mobile, Supabase's Expo SecureStore adapter persists the session across app launches.

## How it works

### Signup

**Mobile** (`app/(auth)/signup.tsx`). The form calls `supabase.auth.signUp` with the user's email, password, and metadata (`full_name`, `date_of_birth`, `gender`). The `emailRedirectTo` is built with `Linking.createURL('/auth/callback', { queryParams: { next: '/' } })` — the `?next=` keeps a valid query string so the email template can append `&token_hash=…&type=signup` to produce the cross-device-safe link shape (see below). If `data.session` is null after signup (email confirmation is required), the screen shows "Check your email" and a resend button. If `data.session` is present (email confirmation is disabled), the auth state listener in the root layout routes the user onward.

**Web** (`web/app/(auth)/signup/page.tsx`). The page uses react-hook-form with a Zod schema that validates all fields client-side, including an `isAdult(dateOfBirth)` check and a password-match refinement. Before calling Supabase, the client calls `precheckSignupAction` — a server action that runs the DB-backed rate-limit check (5 signups/hour per IP, 3/hour per email). It passes the same `emailRedirectTo` pointing to `/auth/callback?next=/onboarding/privacy`. If the returned user has an empty `identities` array, Supabase already has an account for that email; the form surfaces "An account with this email already exists" and offers sign-in and reset-password links. On success, it transitions to the `SignupEmailSuccess` view, which includes a resend button (backed by `supabase.auth.resend({ type: 'signup', email })`).

**Database enforcement.** Regardless of which client sends the signup, the `handle_new_user` DB trigger fires on every insert into `auth.users`. It reads `full_name`, `date_of_birth`, and `gender` from `raw_user_meta_data`, hard-blocks under-18 signups by raising `underage_signup` (SQLSTATE `23514`), silently drops invalid gender values, and inserts a row into `public.user_profiles`. It also seeds the user's default brand list. The trigger is `SECURITY DEFINER`, meaning a client cannot bypass it by altering the session role.

A second trigger, `enforce_profile_identity_rules`, fires on updates to `user_profiles`. It raises `identity_immutable` if anything tries to change `full_name`, `date_of_birth`, or `gender` once they are set (the code comments in the UI warn users "This can't be changed later"). It also enforces the 18+ rule on any belated DOB write, and rate-limits mobile number changes to once per 30 days.

### Login (password)

**Mobile** (`app/(auth)/login.tsx`). Calls `supabase.auth.signInWithPassword`. On success, if the user has neither `email_confirmed_at` nor `phone_confirmed_at`, the app signs them out immediately and shows "Please confirm your email before signing in." On failure, `toAuthErrorMessage` (`src/lib/auth-errors.ts:19`) maps Supabase error codes and message fragments to human-readable copy.

**Web** (`web/app/(auth)/login/actions.ts`). The password form posts to a Next.js server action (`signInWithPasswordAction`). The action validates input with Zod, runs two DB-backed rate-limit checks (10 attempts/10 min per IP, 5 attempts/15 min per email), calls `supabase.auth.signInWithPassword` inside a `withTimeout` wrapper (10–20 second deadline), and then calls Next.js `redirect()` outside the try/catch so the redirect signal is never swallowed. If `email_not_confirmed` comes back, the login page shows a "Resend confirmation email" button that calls the same `precheckResendAction` + `supabase.auth.resend` flow as signup.

The web login also supports **Phone OTP** when the env flag is set: a two-step form (send OTP → verify code) backed by `sendPhoneOtpAction` and `verifyPhoneOtpAction` in `web/app/(auth)/login/_actions/phoneOtp.ts`.

### Login (magic link)

**Mobile** (`app/(auth)/login.tsx:70`). Calls `supabase.auth.signInWithOtp` with `shouldCreateUser: false`. The redirect URL uses `Linking.createURL` so the link deep-links back into the app via `smokeledger://auth/callback?next=/`. The info message is always neutral.

**Web** (`web/app/(auth)/login/page.tsx:363`). The same `signInWithOtp` call, with `shouldCreateUser: false`. The `emailRedirectTo` is constructed client-side as `${window.location.origin}/auth/callback?next=…`. On error the UI still shows the neutral "If this email is registered, we sent a sign-in link" message — the magic-link flow must not reveal whether an address exists.

### The three link shapes and `createSessionFromUrl`

When any email link is clicked, it arrives at the callback with one of three shapes. The shared function `createSessionFromUrl` (`src/lib/authCallback.ts`) handles all three, in priority order:

1. **`token_hash` + `type` query params** — the cross-device-safe path. Calls `supabase.auth.verifyOtp({ token_hash, type })`. This works regardless of which device originally requested the link, because the `token_hash` is the verifiable credential and no PKCE `code_verifier` is required.

2. **`code` query param** — PKCE flow. Calls `supabase.auth.exchangeCodeForSession(code)`. This is same-device only: exchanging the code from a different browser fails because the originating browser's `code_verifier` cookie is absent. (See `docs/architecture/oauth-csrf.md` for why this is correct, not a bug.)

3. **`#access_token` + `#refresh_token` in the URL fragment** — legacy implicit flow. Calls `supabase.auth.setSession({ access_token, refresh_token })`. The mobile deep-link handler picks this up from the hash because React Native's `Linking.getInitialURL` captures the full URL including fragment.

The function returns a `SessionResult`: `'recovery'`, `'signed_up'`, `'signed_in'`, or `'none'`. Callers use this to route the user — recovery links go to the reset-password screen, `signed_up` triggers the welcome celebration, and `none` (failed or expired link) shows an error. Any exception from any of the three paths is caught and mapped to `'none'` rather than propagated.

### Cross-device callbacks

**Mobile** (`app/auth/callback.tsx`). The screen reads the URL from `Linking.getInitialURL()` (cold start) and from a `Linking.addEventListener` listener (warm start). Both can fire for the same link; a `handled` flag ensures the session exchange runs at most once per link. After `createSessionFromUrl` resolves, navigation uses `router.replace` so the callback screen is not in the back stack. If `result === 'signed_up'`, it calls `useAuth.getState().setJustCreated(true)` before navigating home, which triggers the welcome celebration on the next screen.

**Web** (`web/app/auth/callback/route.ts`). A Next.js route handler runs the same link-shape detection (token_hash → `verifyOtp`; code → `exchangeCodeForSession`). On failure it redirects to `/login?error=invalid_or_expired_link`. On success it fetches the user's `user_profiles` row to inspect consent and onboarding status, then routes to:
- `/reset-password` if `type=recovery` or `next=/reset-password`
- `/onboarding/privacy?welcome=1` if this is a `type=signup` link and consent columns are not yet filled
- `/onboarding/privacy` if consent is incomplete for any reason
- The appropriate onboarding step if `onboarded_at` is null
- `nextPath` (if in the allowlist) or `/dashboard` for a returning user

The `next` parameter is sanitized by `sanitizeCallbackNextPath` before any redirect is issued. The allowlist is explicit: shared post-auth paths (`/dashboard`, `/log`, `/log/new`, `/history`, `/trends`, `/settings`) plus callback-only paths (`/reset-password`) plus an explicit enumeration of the seven onboarding routes. Anything else — absolute URLs, path traversal, embedded newlines — is rejected and the user goes to `/dashboard`. Referrer leakage of the recovery token is suppressed with `Referrer-Policy: no-referrer` on every redirect response.

### Password reset

**Mobile.** `app/(auth)/reset.tsx` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`, where `redirectTo` deep-links to `smokeledger://auth/callback?next=/reset-password`. The callback screen routes the user to `app/auth/reset-password.tsx`. That screen calls `supabase.auth.updateUser({ password })`, shows a `ConfettiBurst` on success, waits 600ms (or 2200ms with motion enabled), signs the user out, and navigates to `/login`.

**Web.** `web/app/(auth)/reset/page.tsx` calls `resetPasswordForEmail` with `redirectTo` pointing to `/auth/callback?next=/reset-password`. The callback route detects `type=recovery` and routes to `/reset-password`. `web/app/(auth)/reset-password/page.tsx` calls `supabase.auth.updateUser({ password })`, shows `ConfettiBurst`, then signs the user out after 2600ms and calls `router.replace('/login')`. The comment in the code explains the timing: signing out first can cause middleware to bounce the user to `/login` before the burst animation is visible.

### The `justCreated` flag

`src/store/auth.ts` defines `justCreated: boolean` in the Zustand store (default `false`). It is set to `true` by the mobile callback screen when `createSessionFromUrl` returns `'signed_up'`. The welcome/home screen consumes it and resets it to `false` immediately so the celebration fires exactly once. On web, the equivalent signal is the `?welcome=1` query parameter appended to the `/onboarding/privacy` redirect by the callback route handler when `type === 'signup'`.

### Auth layout guard (mobile)

`app/(auth)/_layout.tsx` reads `session` and `initialized` from the auth store. While `initialized` is false it renders a spinner. Once initialized, if a session exists, it redirects to `/` — a logged-in user cannot land on login or signup screens. This prevents the flash of a login form after a session is restored from SecureStore.

### Error handling and rate limiting

`src/lib/auth-errors.ts` normalises Supabase error shapes into app-friendly messages. It checks `.code` first, then falls back to scanning `.message` for known fragments (`invalid login credentials`, `email not confirmed`, `rate limit`, `captcha`). The mapped codes are `invalid_credentials`, `email_not_confirmed`, `too_many_requests`, and `captcha_required`. Unknown errors go through `toSafeErrorMessage` which returns a generic copy — raw internal error text never reaches the user.

All email-sending surfaces (signup, password reset, resend confirmation) are guarded by `precheckSignupAction` / `precheckResetAction` / `precheckResendAction` (`web/app/(auth)/_actions/authPrechecks.ts`), which call a DB-backed token-bucket RPC (`consume_rate_limit`). These are fail-open: if the service-role key is missing or the DB is unavailable, the check passes and Supabase's native rate limits serve as the backstop. Thresholds live in `web/lib/auth/authRateLimitKeys.ts`: signup is 5/hour per IP and 3/hour per email; reset is 10/hour per IP and 3/hour per email; resend is 3/hour per email.

All auth calls on the web are wrapped in `withTimeout` with a `DEFAULT_AUTH_TIMEOUT_MS` deadline (between 10 and 20 seconds). A timed-out call throws `TimeoutError`, which is caught by `safeAuthCatchState` and mapped to `dependency_failure` — a clear spinner error rather than an indefinitely spinning button.

## Invariants

- `handle_new_user` fires on every new `auth.users` insert. There is no code path that creates an auth user without also attempting a `user_profiles` insert. If the trigger raises `underage_signup`, Supabase aborts the auth insert and the signup fails.
- `full_name`, `date_of_birth`, and `gender` cannot be changed after they are first set. The `enforce_profile_identity_rules` trigger raises `identity_immutable` on any update attempt.
- `createSessionFromUrl` always returns one of four known string literals. It never throws to the caller — all exceptions from Supabase are caught internally and mapped to `'none'`.
- The mobile callback screen processes each link at most once, enforced by the `handled` boolean. Cold-start and warm-start Linking events are both handled without double-calling `verifyOtp` or `exchangeCodeForSession`.
- The `next` redirect parameter on web is validated against an explicit allowlist before any redirect is issued. No open-redirect is possible through the callback route.
- The magic-link flow on login never creates users (`shouldCreateUser: false`). Only the signup form creates users.
- All error messages shown to users are either pre-approved human-readable strings or the output of `toSafeErrorMessage`, which returns a fixed generic string on unknown inputs.

## Edge cases and gotchas

**The link was opened on a different device.** The `token_hash` + `type` shape (`verifyOtp`) works across devices because the verifier is server-stored. The `code` shape (`exchangeCodeForSession`) fails on a different device because the PKCE `code_verifier` cookie belongs to the originating browser. The email template must produce `token_hash` links to make cross-device opens work. If you see "invalid or expired link" only when opening on a different device, the email template is sending `code` links instead — check the Supabase Auth dashboard email template settings.

**Double delivery of the same URL.** When a deep-link wakes the mobile app from a cold start, both `Linking.getInitialURL()` and the `url` event can fire with the same URL. The `handled` flag in `app/auth/callback.tsx:23` prevents a double session exchange, which would fail the second time (the OTP/code is single-use).

**Email confirmation disabled.** If "Confirm email" is turned off in the Supabase dashboard, `signUp` returns a session immediately. The signup screen checks for `!data.session` to decide whether to show "check your email". If the session is present, the auth state listener routes the user to onboarding. The web callback's `type=signup` branch fires the `?welcome=1` only when the link is actually clicked, so this flag is not set on the no-confirmation path — `justCreated` / `?welcome=1` will not appear and the celebration is skipped.

**Existing email on signup.** Supabase returns a user with an empty `identities` array when the email already exists and is confirmed. The web signup page checks for this and shows "An account with this email already exists" with links to sign in or reset. The mobile signup form does not have this check — it relies on Supabase's error response, which may surface as a generic error on the mobile side.

**Neutral copy on password reset and magic-link.** Both flows show the same success message whether or not the address exists. This is intentional (account enumeration protection). Don't "improve" the messages to say "no account found" — that would reveal which addresses are registered.

**captcha_required on mobile.** The mobile login form does not implement Turnstile. If Supabase-side captcha is enabled and the Supabase anon key sends captcha tokens for web clients but not mobile clients, mobile password login will fail with `captcha_required`. The error is handled (`src/lib/auth-errors.ts:25`) and surfaced as "Security check failed or is not configured on this device."

**The `?welcome=1` flag is URL-carried, not device-local.** On web, the welcome signal travels in the redirect URL, not in localStorage or a cookie. If a user opens the confirmation link, lands on `/onboarding/privacy?welcome=1`, and then navigates away and comes back, the flag is gone. The celebration fires at most once per link click, which is the intended behaviour.

**Rate limit fail-open contract.** The `checkRateLimits` calls in `authPrechecks.ts` are deliberately fail-open. If the service-role key is not configured (e.g. in a stripped-down staging environment), abuse prevention falls back to Supabase's native limits only. This is documented in the code and the SCALING_PLAN — it is a known trade-off, not a bug.

**Password reset sign-out timing.** Both mobile and web wait before signing the user out after a successful password update. Mobile waits 600ms (reduce-motion) or 2200ms; web waits 2600ms. This keeps the session alive while the confetti burst plays. Signing out first triggers the middleware redirect before the user sees the success screen. The "Continue to sign in →" link on the web page lets the user skip ahead if they don't want to wait.

## Tests

**`src/tests/authCallback.test.ts`** — covers all three link shapes through `createSessionFromUrl`. Verifies that `token_hash`+`type` calls `verifyOtp` and returns `'recovery'`, `'signed_up'`, or `'signed_in'`; that `code` calls `exchangeCodeForSession`; that hash-fragment tokens call `setSession`; that API failures return `'none'`; and that a bare or malformed URL returns `'none'`. Tests use a mock Supabase client — no network required.

**`src/tests/auth-errors.test.ts`** — tests the message-fragment → error code mapping in `getAuthErrorCode` and the code → user-visible string mapping in `toAuthErrorMessage`. Verifies the fallback to "Something went wrong" for unknown errors.

**`web/__tests__/authErrors.test.ts`** — parallel Vitest suite covering the same `auth-errors.ts` exports from the web test runner, confirming the module is importable in both environments.

**`src/tests/web-auth-redirect.test.ts`** — covers `sanitizeNextPath` and `isAllowedNextPath` from `web/lib/auth/redirect.ts`. Verifies that allowed paths pass through unchanged (including query strings and hashes), and that absolute URLs, protocol-relative URLs, path traversal, wrong-case paths, and embedded newlines are all rejected in favour of the fallback (`/dashboard`).

**`src/tests/web-auth-callback-sanitize.test.ts`** — covers `_sanitizeCallbackNextPath` from the callback route's allowlist logic. Verifies the three-tier allowlist (shared post-auth paths + callback-only `/reset-password` + explicit onboarding enumeration), query-string preservation (regression guard for a specific past bug where `/log?ref=widget` was being stripped to `/log`), and rejection of unrecognised onboarding paths (e.g. `/onboarding/evil`).

**`src/tests/web-auth-rate-limit-keys.test.ts`** — verifies the threshold values in `authRateLimitKeys.ts`: signup is 5/h per IP and 3/h per email; reset is 10/h per IP and 3/h per email; resend is 3/h per email. Also verifies that email keys are normalised to trimmed lowercase and that IP keys are not modified.

**`src/tests/web-auth-timeout.test.ts`** — verifies `withTimeout` resolves fast promises, rejects slow ones with `TimeoutError`, propagates early rejections, accepts Supabase-style `PromiseLike` (not just `Promise`), and that `DEFAULT_AUTH_TIMEOUT_MS` is in the 10–20 second range.

**`web/e2e/auth-smoke.spec.ts`** — Playwright suite. The credential-gated test (`E2E_LOGIN_EMAIL` / `E2E_LOGIN_PASSWORD`) verifies that the password form posts via a server action (not a client fetch), that the response is 200/303/302, that the user lands on `/dashboard` or `/onboarding`, and that a Supabase auth cookie is set. Three unconditional tests verify that the signup, login, and reset pages render their expected fields without credentials.

## Open gaps

**Mobile duplicate-email detection.** The web signup detects a duplicate email by checking `data.user.identities.length === 0`. The mobile signup (`app/(auth)/signup.tsx`) does not have this check and relies on the raw Supabase error, which arrives as a generic error message. A user who tries to sign up with an email that already exists on mobile will see a less helpful error than on web.

**Phone OTP on mobile.** The web login page has a Phone OTP mode. There is no equivalent on mobile — the login screen has only `'password'` and `'magic-link'` modes.

**`justCreated` and web `?welcome=1` are separate mechanisms.** The mobile flag is Zustand state; the web signal is a URL parameter. They are functionally equivalent but are not unified. If the onboarding screens ever need to behave differently between the two platforms' welcome signals, they currently read from different sources with no shared abstraction.

**No automated test for the full mobile deep-link flow end-to-end.** The `createSessionFromUrl` logic is unit-tested, and the web E2E suite covers the web callback. But there is no Detox or Maestro test that opens an actual deep link and verifies the mobile callback screen navigates correctly. This is a manual-only test at present.

**Captcha on mobile.** Mobile password sign-in does not send a captcha token. If Supabase-side captcha is enforced globally (not scoped to web), mobile sign-in will fail. The error is handled gracefully but the feature is effectively blocked. As of the last manual check, captcha is not enforced on mobile in the Supabase dashboard, but this is not asserted in any automated test.
