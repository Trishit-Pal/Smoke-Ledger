# Cross-device email auth links

## What changed

Supabase email links (signup confirmation, magic-link sign-in, password reset) now
verify via a **token hash** instead of the device-bound PKCE `?code=`. The link carries
`?token_hash=…&type=…`, and our callbacks verify it with
`verifyOtp({ token_hash, type })`:

- Web: `web/app/auth/callback/route.ts`
- Mobile: `src/lib/authCallback.ts` (via `app/auth/callback.tsx`)

`verifyOtp` needs no locally-stored verifier, so a link opened on a **different device**
than the one that requested it works. The web flows (the primary surface) are now fully
cross-device. See the templates in `supabase/templates/` and the wiring in
`supabase/config.toml` under `[auth.email.template.*]`.

The link is built from `{{ .RedirectTo }}` (the per-request redirect), so one global
template serves both web (`https://…/auth/callback?next=…`) and mobile
(`smokeledger://auth/callback?next=…`). Every auth call now passes a redirect that already
contains `?next=…`, so the template can append `&token_hash=…&type=…` as a valid query
string.

## Apply to the hosted project (`tvcwrsglceahkjnfuzkn`)

Pick one:

### Option A — CLI (version-controlled, recommended)

1. Link once if needed: `supabase link --project-ref tvcwrsglceahkjnfuzkn`
2. Fill in the real production web origin in `supabase/config.toml` under the existing
   `[auth]` block (uncomment `site_url` + `additional_redirect_urls`).
3. Push the auth config + templates: `supabase config push`

### Option B — Dashboard

1. **Authentication → Email Templates** → for **Confirm signup**, **Magic Link**, and
   **Reset Password**, paste the matching file from `supabase/templates/` (`confirmation.html`,
   `magic_link.html`, `recovery.html`).
2. **Authentication → URL Configuration** → set **Site URL** to the production web origin
   and add both of these to **Redirect URLs**:
   - `https://<production-web-domain>/auth/callback`
   - `smokeledger://auth/callback`

The redirect allowlist step is **required** — without it Supabase rejects the links.

## Verify (cross-device)

1. On a **desktop**, request a password reset and (separately) a magic-link sign-in.
2. Open each email **on a phone**. Each should land on the reset screen / sign you in —
   no "invalid or expired link" error.
3. Repeat the reverse direction (request on phone, open on desktop).
4. Confirm the **same-device** flows still work (request and open on one device).
5. Confirm a brand-new signup confirmation works on any device and shows the welcome
   celebration on the first onboarding screen.

## Known limitation — mobile custom-scheme links

Mobile-initiated links redirect to the `smokeledger://` custom scheme, which only resolves
on a device that has the app installed. Opening a mobile-initiated link on a device
**without** the app cannot deep-link. Web (https) links remain universal. Making mobile
links truly universal requires **Universal Links (iOS) / App Links (Android)** — an https
domain-verification setup (`apple-app-site-association` / `assetlinks.json`) tracked as a
future enhancement.
