-- Retire the misrecorded marketing-consent stamps.
--
-- user_profiles.marketing_consent_at is read by nothing in the app and never
-- shown, but export_account_data() includes it. The only code that ever wrote
-- it was the old mobile consent screen, which stamped it from the *analytics*
-- checkbox (analytics opt-in is not marketing consent). Web never wrote it and
-- the shared consent service (src/services/onboarding.ts) no longer does. So
-- every non-null value is a consent the user never gave.
--
-- 1. Clear every stamp and leave one compliance audit row per affected user,
--    in a single statement so both see exactly the same rows. Props carry no
--    PII (no timestamp, no email). The event type is server-only: it is not in
--    the client audit registry, the edge allowlist or the /api/audit schema.
-- 2. A CHECK keeps the column empty for every role. The user_profiles UPDATE
--    policy is row-wide, so without it any signed-in client could write the
--    column again. erase_account_data() already writes NULL, so it is unaffected.
--
-- Idempotent: a re-run clears nothing, inserts nothing, and re-adds the CHECK.

WITH cleared AS (
  UPDATE public.user_profiles
     SET marketing_consent_at = NULL
   WHERE marketing_consent_at IS NOT NULL
  RETURNING id
)
INSERT INTO public.audit_events (user_id, event_type, event_category, props_json)
SELECT id, 'marketing_consent_cleared', 'compliance',
       jsonb_build_object('reason', 'analytics_opt_in_misrecorded')
  FROM cleared;

-- ponytail: CHECK instead of a trigger or column grant. Drop it in the
-- migration that ships a genuine marketing opt-in (with its own audit event).
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_marketing_consent_unused;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_marketing_consent_unused
  CHECK (marketing_consent_at IS NULL);
