# Smoke Ledger Privacy Policy

Effective date: 2026-11-02

## Summary
- Smoke Ledger is a smoking reduction and cessation support app.
- We collect account, product, and operational security data required to run the service.
- We do not sell personal data and we do not run ad network SDKs.
- Health-adjacent behavior data is treated as restricted data.

## Data Categories
- Account: email, auth metadata, session lifecycle events.
- Product: logs, triggers, moods, goals, reminders, onboarding preferences, settings.
- Security/ops: audit events, rate-limit signals, redacted errors.
- Questions you type into Ask the ledger, if you turn it on; passed to the AI processor below and not stored by us.

## Why We Process Data
- Deliver core app functionality and sync.
- Secure accounts and infrastructure.
- Respond to support, export, correction, and deletion requests.
- Answer your questions about your own ledger through an AI model, only if you turn Ask the ledger on (opt-in).

## Retention
- Product data (logs, brands, goals, settings) is retained until you **erase data** or **delete your account**.
- **Erase data** (Settings): wipes product tables and resets your profile for re-onboarding. Your login is kept. Audit rows are anonymized (`user_id` removed, hashed identifier in props) for abuse-prevention counts.
- **Delete account** (Settings): removes your Supabase Auth identity and cascades product data. A compliance delete event may be retained in anonymized form for incident response.
- Security/audit data is retained for abuse prevention and incident response windows per operational policy.

## Sharing
- Data is processed by hosting providers required to run the service (Supabase for auth and database, Vercel for web hosting, Cloudflare Turnstile for sign-in abuse checks when enabled, an SMS provider for phone sign-in codes). The database is hosted in the United States (AWS us-east-2).
- **Ask the ledger** (optional, off by default) answers questions about your own ledger using an AI model operated by Anthropic, PBC (United States). If you turn it on, each question and the figures needed to answer it are sent to Anthropic: totals, trends, spend by brand, time-of-day and weekday patterns, mood and trigger counts, goal progress and targets, your daily baseline, and your country-level currency and time zone. When a question needs them, so are your recent entries from the last 30 days: dates, times, quantities, triggers, moods, cravings, the situation you tagged, brand names, your own notes. In discreet mode, brand names are aliased and notes are not sent; a brand name typed into a question is sent as typed. Anthropic does not train on this data and deletes it after a limited retention period (currently up to 30 days) unless it must be kept longer for safety or legal reasons. We store no questions, replies, or conversations on our servers; the conversation lives on the device you used until you sign out, erase your data, delete your account, or turn the feature off.
- No data sharing with ad networks or data brokers.

## User Rights
- Access, correction, export, deletion, and account closure.
- Contact support for requests and verification.

## Medical Notice
- Smoke Ledger is not a medical device and does not provide medical advice.
