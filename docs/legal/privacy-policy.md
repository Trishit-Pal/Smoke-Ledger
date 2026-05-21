# Smoke Ledger Privacy Policy

Effective date: 2026-05-19

## Summary
- Smoke Ledger is a smoking reduction and cessation support app.
- We collect account, product, and operational security data required to run the service.
- We do not sell personal data and we do not run ad network SDKs.
- Health-adjacent behavior data is treated as restricted data.

## Data Categories
- Account: email, auth metadata, session lifecycle events.
- Product: logs, triggers, moods, goals, reminders, onboarding preferences, settings.
- Security/ops: audit events, rate-limit signals, redacted errors.

## Why We Process Data
- Deliver core app functionality and sync.
- Secure accounts and infrastructure.
- Respond to support, export, correction, and deletion requests.

## Retention
- Product data (logs, brands, goals, settings) is retained until you **erase data** or **delete your account**.
- **Erase data** (Settings): wipes product tables and resets your profile for re-onboarding. Your login is kept. Audit rows are anonymized (`user_id` removed, hashed identifier in props) for abuse-prevention counts.
- **Delete account** (Settings): removes your Supabase Auth identity and cascades product data. A compliance delete event may be retained in anonymized form for incident response.
- Security/audit data is retained for abuse prevention and incident response windows per operational policy.

## Sharing
- Data is processed by hosting providers required to run the service.
- No data sharing with ad networks or data brokers.

## User Rights
- Access, correction, export, deletion, and account closure.
- Contact support for requests and verification.

## Medical Notice
- Smoke Ledger is not a medical device and does not provide medical advice.
