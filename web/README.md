# Smoke Ledger Web

## Purpose

Primary customer-facing surface for Smoke Ledger.

## Required Environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPPORT_EMAIL` (recommended)

## Local Development

```bash
npm install
npm run dev
```

## Production Deployment Notes

- Deploy on Vercel (Hobby/Pro) or another Next.js host.
- Configure Supabase Auth redirect URLs to include:
  - `https://<your-domain>/auth/callback`
  - `https://<your-domain>/login`
- If using OTP:
  - enable Email OTP / magic link in Supabase Auth
  - enable Phone provider (Twilio/MessageBird/Vonage/etc.) for SMS OTP
- Ensure legal routes are live:
  - `/privacy`
  - `/terms`
  - `/support`
- Verify middleware behavior in preview:
  - unauthenticated user -> `/login` for app routes
  - authenticated non-onboarded user -> `/onboarding/privacy`
  - authenticated onboarded user -> `/dashboard`
