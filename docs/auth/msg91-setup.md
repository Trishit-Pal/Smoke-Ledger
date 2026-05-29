# Phone-OTP via MSG91 (production setup)

This guide turns on the `phone_otp` login mode end-to-end. The web client already supports the flow behind the `NEXT_PUBLIC_PHONE_OTP_ENABLED` kill switch; this document covers everything that has to be done outside the repo before flipping the switch.

## Prerequisites (offline, multi-day)

1. **TRAI DLT registration.** Register a principal entity ID at any DLT registrar (Jio, Vodafone, Vi, BSNL, etc.). Approval takes 24–72 hours and is a one-time step.
2. **MSG91 account + DLT template approval.** Inside MSG91 Dashboard:
   - Add the DLT entity ID under *DLT Compliance → Entity*.
   - Submit a transactional template containing the OTP variable, for example:
     ```
     Smoke Ledger code: ##OTP##. Never share this code. - SMOKLR
     ```
     Approval typically takes 12–24 hours.
3. **Sender ID.** Provision a 6-character alphabetic sender ID (e.g. `SMOKLR`) and bind it to the entity above. Sender IDs are also DLT-approved separately.
4. **MSG91 API key.** Generate an auth key in *MSG91 Dashboard → API Keys*. This is the key the edge function uses; rotate it on a schedule.

## Supabase Edge Function deploy

```
supabase functions deploy send-sms-otp
```

Set the following secrets (Dashboard → Edge Functions → Secrets, or `supabase secrets set`):

| Secret | Source |
| --- | --- |
| `MSG91_AUTH_KEY` | MSG91 → API Keys |
| `MSG91_TEMPLATE_ID` | MSG91 → DLT → Templates → approved template ID |
| `MSG91_SENDER_ID` | MSG91 → DLT → Senders → approved sender ID |
| `SUPABASE_SMS_HOOK_SECRET` | A 32-byte base64 string you generate; the Dashboard Send-SMS Hook config must use the same value. |

A safe way to generate the hook secret:

```
openssl rand -base64 32
```

## Supabase Dashboard — Auth Hook wiring

1. Open *Authentication → Hooks → Send SMS Hook*.
2. Enable the hook.
3. Set the URL to `https://<project-ref>.supabase.co/functions/v1/send-sms-otp`.
4. Set the HMAC secret to the same value as `SUPABASE_SMS_HOOK_SECRET`.
5. Save.

## Supabase Auth — SMS provider config

Under *Authentication → Providers → Phone*:

- Enable phone provider.
- SMS provider: `Custom Auth Hook` (the hook above takes over delivery).
- Template: `Smoke Ledger code: {{ .Code }} — never share.` (kept for fallback display only; the hook overrides delivery).
- OTP expiry: 5 minutes is reasonable.
- Min frequency between messages: `1m0s`. This is Supabase's built-in throttle.

## Optional — mirror config locally

If you also want `supabase start` to know about the hook, uncomment the `[auth.sms]` / `[auth.hook.send_sms]` blocks in `supabase/config.toml`. The repo ships them commented out because older CLI versions reject those keys.

## Web env — flip the kill switch

Add to Vercel (or your hosting provider):

```
NEXT_PUBLIC_PHONE_OTP_ENABLED=true
```

Until this is `true`, the `Phone OTP` tab is hidden from `MODE_OPTIONS` on the login page even if everything above is configured. This is the safe-default rollout switch — once you've delivered a successful test SMS end-to-end, flip it on.

## Smoke test

1. Open `/login`, choose Phone OTP.
2. Enter a real `+91` number you control.
3. Verify the SMS arrives within 15 seconds.
4. Enter the code → expect redirect to `/` (or whatever `next` was supplied).
5. Check Supabase logs:
   - `send-sms-otp` should log `sms_dispatched` for each send.
   - `audit_events` should record `phone_otp_sent` / `phone_otp_verified` once the audit telemetry is wired (currently allowlisted but the client doesn't yet emit them).

## Rate limits in effect

| Layer | Key | Max | Window |
| --- | --- | --- | --- |
| Web server action | `phone_otp_send_ip:<ip>` | 10 | 600s |
| Web server action | `phone_otp_send_phone:<e164>` | 3 | 600s |
| Web server action | `phone_otp_verify_phone:<e164>` | 5 | 600s |
| Edge function | `send-sms-otp:phone:<e164>` | 3 | 600s |
| Supabase Auth | `max_frequency` | 1 | 1 minute |

These compose: the strictest layer wins.

## Rollback

If MSG91 sends spiral (cost, abuse, or a broken template):

1. In Vercel, set `NEXT_PUBLIC_PHONE_OTP_ENABLED=false` and redeploy. The mode hides immediately.
2. The server actions also short-circuit with a `disabled` state if the env var is `false`, so an attacker who calls the action directly receives a friendly refusal.
3. If you need to stop existing in-flight OTP sends, disable the hook in *Authentication → Hooks*. Supabase will stop calling the edge function but `signInWithOtp` will fail open (return an error).
