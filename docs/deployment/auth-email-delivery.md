# Auth email delivery (signup confirmation, magic links, reset)

Smoke Ledger uses Supabase Auth to send transactional email. The web app calls `signUp` / `signInWithOtp` / `resetPasswordForEmail`; **delivery is configured in the Supabase dashboard**, not in app code.

## When email is sent

| User action | Email sent? |
|-------------|-------------|
| Sign up with password | Yes — confirmation link (if **Confirm email** is ON) |
| Sign in with password | No |
| Login → Email link tab | Yes — magic sign-in link (existing accounts only) |
| Sign up with email link | Yes — signup / magic link |
| Forgot password | Yes — recovery link |

If signup shows **“Check your email”** with no error, Supabase accepted the request. Missing mail is almost always dashboard mail config, rate limits, or spam filtering.

---

## 1. Diagnose (Authentication → Users & Logs)

### Users

1. Open **Authentication → Users**
2. Find the test email
3. Expected before confirm: user exists, **email not confirmed**
4. If no user: signup failed — check browser Network tab for the `/auth/v1/signup` response

### Auth logs

1. Open **Authentication → Logs** (or project **Logs** filtered to Auth)
2. Look for `signup`, `user_confirmation_requested`, or mail errors around the attempt
3. Common failures:
   - **Rate limit exceeded** — built-in mailer cap hit (see below)
   - **SMTP error** — custom SMTP misconfigured
   - **Invalid template** — broken email template variables

---

## 2. URL configuration (required for working links)

**Authentication → URL Configuration**

### Local development

| Setting | Value |
|---------|--------|
| Site URL | `http://localhost:3000` |
| Redirect URLs | `http://localhost:3000/auth/callback` |
| | `http://localhost:3000/**` |

### Production

| Setting | Value |
|---------|--------|
| Site URL | `https://your-domain.com` |
| Redirect URLs | `https://your-domain.com/auth/callback` |
| | `https://your-domain.com/**` |

Wrong redirect URLs break the link **after** click; email may still arrive.

---

## 3. Built-in mailer rate limits

Supabase’s **default auth SMTP** on the free tier allows only **a few auth emails per hour per project**. During repeated signup tests, the API can return success while **no email is queued**.

**Mitigations:**

- Wait 60+ minutes, then try **one** signup with a **new** email address
- Check spam/junk (sender often `@mail.app.supabase.io` or similar)
- Do not re-signup the same address repeatedly in a short window
- Configure custom SMTP (next section) for reliable dev/staging

---

## 4. Custom SMTP (recommended)

**Authentication → Email → SMTP Settings → Enable custom SMTP**

### Resend (free tier: ~100 emails/day)

1. Create account at [resend.com](https://resend.com)
2. Add and verify a domain (or use Resend’s onboarding domain for testing)
3. Create an API key with **Sending access**
4. In Supabase SMTP settings:

| Field | Example |
|-------|---------|
| Host | `smtp.resend.com` |
| Port | `465` (SSL) or `587` (TLS) |
| Username | `resend` |
| Password | Your Resend API key |
| Sender email | `noreply@yourdomain.com` |
| Sender name | `Smoke Ledger` |

5. Use **Send test email** in the dashboard
6. Sign up again with a fresh email

Other providers (Brevo, Amazon SES, Postmark) work the same way — use their SMTP host/port/credentials.

---

## 5. Dev-only workarounds

Use only for local testing; re-enable confirm email before shared environments.

**Option A — Manual confirm**

1. **Authentication → Users** → select user
2. Confirm email (or set `email_confirmed_at`)

**Option B — Disable confirm email temporarily**

1. **Authentication → Providers → Email**
2. Turn off **Confirm email**
3. New signups can sign in immediately without mail

---

## 6. Captcha (Turnstile)

If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set in `web/.env.local`:

- **Authentication → Bot and Abuse Protection → Captcha** → Cloudflare Turnstile
- Paste the **secret** that matches the site key
- Mismatch usually returns a **visible error** on signup (not silent success)

---

## 7. Verification checklist

- [ ] User appears in **Authentication → Users** after signup
- [ ] Auth logs show no mail/rate-limit errors
- [ ] Confirmation email arrives within ~2 minutes (check spam)
- [ ] Link opens `http://localhost:3000/auth/callback` (or production URL)
- [ ] Redirect lands on `/onboarding/privacy`
- [ ] Password login works after confirm (no “email not confirmed”)

---

## App-side resend

The signup success screen includes **Resend confirmation email**, which calls `supabase.auth.resend({ type: 'signup', email })`. This still depends on Supabase mail delivery — fix SMTP/rate limits if resend also fails.
