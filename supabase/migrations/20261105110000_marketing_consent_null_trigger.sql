-- Keep user_profiles.marketing_consent_at empty with a trigger, not a CHECK.
--
-- 20261102120000_clear_marketing_consent.sql added CHECK (marketing_consent_at
-- IS NULL). A mobile build installed before that fix still sends
-- `marketingConsentAt: analyticsOptIn ? now : null` in the same profile update
-- that stamps the consent versions, so for any reader who ticks analytics the
-- whole consent update fails with 23514 and they cannot get past consent
-- (there are no over-the-air mobile updates). A BEFORE trigger lets that write
-- succeed and still leaves the column empty for every role; the user_profiles
-- UPDATE policy is row-wide, so the guard has to live in the database.
--
-- export_account_data() only reads the column and erase_account_data() writes
-- NULL, so neither relied on the CHECK. The cleared-stamps audit rows from the
-- earlier migration are untouched.
--
-- ponytail: drop the trigger and function in the migration that ships a
-- genuine marketing opt-in (with its own audit event).
--
-- Idempotent: DROP ... IF EXISTS + CREATE OR REPLACE.

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_marketing_consent_unused;

CREATE OR REPLACE FUNCTION public.null_marketing_consent_at ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.marketing_consent_at := NULL;
  RETURN NEW;
END;
$$;

-- Checked at CREATE TRIGGER time, not when the trigger fires (same convention
-- as keep_onboarding_step_monotonic() and goals_stamp_completed_at()).
REVOKE ALL ON FUNCTION public.null_marketing_consent_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_user_profiles_marketing_consent_null ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_marketing_consent_null
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.null_marketing_consent_at();

COMMENT ON FUNCTION public.null_marketing_consent_at() IS
  'Forces user_profiles.marketing_consent_at to NULL: no marketing opt-in exists; older mobile builds still write it.';
