-- user_profiles.onboarding_step only ever moves forward.
--
-- The column means "the next onboarding page the user should see"; every step
-- writes the following step as it saves. Without this guard, going Back to an
-- earlier step and pressing Continue again rewrote the step to an earlier value,
-- after which the middleware bounced the user away from pages they had already
-- completed. Enforcing it here (not in each client) covers web, mobile, and
-- concurrent writers with no extra read.
--
-- Rank mirrors ONBOARDING_STEP_INDEX in src/lib/onboardingSteps.ts and must be
-- widened together with user_profiles_onboarding_step_check. An unknown value
-- ranks NULL, so the comparison below is NULL (no swap) and the CHECK still
-- rejects it, exactly as before this migration.
-- A NULL step on either side passes through: erase_account_data() resets the
-- step to NULL on purpose, and a NULL old value is a fresh row being initialised.
--
-- Idempotent: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.

CREATE OR REPLACE FUNCTION public.onboarding_step_rank (step text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE step
    WHEN 'privacy'  THEN 0
    WHEN 'usage'    THEN 1
    WHEN 'setup'    THEN 1
    WHEN 'baseline' THEN 1
    WHEN 'goal'     THEN 2
    WHEN 'brands'   THEN 3
    WHEN 'done'     THEN 4
    ELSE NULL
  END;
$$;

-- The trigger function is SECURITY INVOKER, so the writing role (authenticated
-- for clients, service_role for seeds) must be able to EXECUTE the helper; do
-- not revoke it from authenticated. The trigger function itself is checked at
-- CREATE TRIGGER time, not when it fires. Same convention as enforce_profile_region().
REVOKE ALL ON FUNCTION public.onboarding_step_rank(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboarding_step_rank(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.keep_onboarding_step_monotonic ()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.onboarding_step IS NULL OR OLD.onboarding_step IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.onboarding_step_rank(NEW.onboarding_step)
     < public.onboarding_step_rank(OLD.onboarding_step) THEN
    NEW.onboarding_step := OLD.onboarding_step;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_onboarding_step_monotonic() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_user_profiles_onboarding_step_monotonic ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_onboarding_step_monotonic
  BEFORE UPDATE OF onboarding_step ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_onboarding_step_monotonic();

COMMENT ON FUNCTION public.keep_onboarding_step_monotonic() IS
  'Keeps user_profiles.onboarding_step from moving backwards (NULL resets allowed).';
