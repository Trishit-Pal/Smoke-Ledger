# OAuth callback CSRF protection (M6 audit note)

## Context

The web app's auth callback (`web/app/auth/callback/route.ts`) handles two paths:

1. **OAuth providers** — Supabase's "Sign in with X" flow returns the user via redirect with a `code` query parameter, which the callback exchanges for a session using `supabase.auth.exchangeCodeForSession(code)`.
2. **Email magic links / password recovery** — Same `code` parameter mechanism; the SDK distinguishes the intent via `type=recovery` etc.

The audit raised the question: **the callback does not explicitly validate an OAuth `state` parameter**. Is the flow vulnerable to CSRF (an attacker injects a stolen `code` and tricks a victim into linking their browser to the attacker's session)?

## Why explicit state validation is not present

Supabase's web SDK (`@supabase/ssr` and the underlying `@supabase/supabase-js`) uses the **PKCE flow** (Proof Key for Code Exchange — RFC 7636) for all OAuth and email-link authentications. PKCE replaces (and is stronger than) the classical OAuth `state` parameter for CSRF and code-injection protection:

| Concern | OAuth `state` (classical) | PKCE (Supabase) |
|---|---|---|
| Where the secret lives | Server side-state or signed cookie | `code_verifier` cookie, set by the SDK before redirect |
| What the auth server returns | `state` echoed back | `code` only |
| What protects against CSRF | Comparing returned `state` to stored one | The exchange requires the `code_verifier`, which only the originating browser has |
| What protects against code-injection | None (state is opaque to the auth server) | Auth server verifies `code_verifier` matches the `code_challenge` it received at redirect time |

In other words: a stolen `code` cannot be exchanged from a different browser, because that browser doesn't have the matching `code_verifier` cookie. This is structurally equivalent to (and arguably stronger than) `state`-based CSRF protection.

## Verification

To verify the SDK actually performs the PKCE exchange:

1. Inspect the SDK source for the verifier construction:
   ```bash
   grep -rn "code_verifier\|pkceCodeChallenge\|codeChallenge" node_modules/@supabase/ssr node_modules/@supabase/supabase-js
   ```
   The SDK's `OAuthHelper` / `SignInWithOAuthCredentials` path stores the verifier in cookies (server-side via `cookies.setAll`, client-side via the browser client).

2. Inspect the cookie set by the SDK when a redirect to the OAuth provider is initiated:
   - Open DevTools → Application → Cookies for the app origin
   - Trigger a sign-in
   - Observe `sb-<project-ref>-auth-token-code-verifier` (or a similarly named cookie)
   - The cookie value is a random base64url string — that is the `code_verifier`
   - Confirm the cookie has `HttpOnly`, `Secure`, `SameSite=Lax`

3. Inspect the redirect URL to the OAuth provider:
   - Should include `code_challenge=...` and `code_challenge_method=S256`
   - If `code_challenge_method` is missing or set to `plain`, PKCE is downgraded — file an issue with `@supabase/supabase-js`. (We have not observed this; the SDK defaults to S256.)

4. Inspect the callback exchange:
   - `web/app/auth/callback/route.ts` calls `supabase.auth.exchangeCodeForSession(code)`
   - The SDK retrieves the `code_verifier` from the cookie automatically and includes it in the POST to Supabase's `/auth/v1/token` endpoint
   - The Supabase auth backend rejects the exchange if the verifier doesn't match the original challenge

## What we additionally do beyond PKCE

The callback also enforces:

- **`next` path allowlist** (`web/lib/auth/redirect.ts`, hardened in C2) — prevents the callback from being used as an open-redirect vector regardless of CSRF status.
- **Origin-bound cookie scope** — auth cookies are `Secure`, `HttpOnly`, `SameSite=Lax`, set by the server adapter (`web/lib/supabase/server.ts`).
- **CSP and HSTS** — `web/lib/security/csp.ts` blocks cross-origin script injection that could observe or replay auth flow artefacts.

## Known caveats

- **Same-browser CSRF is theoretically possible** — if an attacker can write to the victim's cookie store (XSS, browser bug, malicious extension), they can inject their own `code_verifier` and then trigger a sign-in that exchanges their own `code`. PKCE is not designed to protect against compromised browsers; that's a different threat model (defended by CSP and `HttpOnly` cookies).
- **Magic-link reuse** — Supabase emails are single-use codes by default; reuse fails the PKCE exchange. Verify this is enabled in the Supabase Auth dashboard (Settings → Auth → Email — "Confirm sign-in URLs are single use" should be on).

## Decision

We rely on Supabase SDK's PKCE implementation for OAuth CSRF protection. The codebase does not duplicate state validation because (a) the SDK does not surface `state` for us to validate, and (b) PKCE provides the equivalent guarantee at the protocol level. If a future audit re-raises this, point them at this document.

If Supabase ever ships an opt-in to classical `state` alongside PKCE (or migrates away from PKCE), revisit this assumption.

## Related files

- `web/app/auth/callback/route.ts` (callback handler)
- `web/lib/supabase/server.ts` (cookie policy that stores the `code_verifier`)
- `web/lib/auth/redirect.ts` (post-auth allowlist — defense in depth)
- `node_modules/@supabase/ssr/dist/main/cookies.js` (SDK cookie names — read on each version bump)
