-- Align user_profiles.onboarding_step CHECK constraint with the seven-step
-- application flow.
--
-- The original constraint was added in 20260520000000_security_correctness.sql
-- but omitted 'usage'. The application's first onboarding transition writes
-- onboarding_step = 'usage' from web/app/onboarding/privacy/page.tsx, which
-- Postgres rejects with 23514 (check constraint violation). Until this
-- constraint is widened, no new user can advance past /onboarding/privacy.
--
-- The widened set matches src/domain/onboarding-steps.ts (the canonical TS
-- source of truth introduced in the same change set) and the step index in
-- web/middleware.ts. Idempotent — safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_onboarding_step_check'
  ) THEN
    ALTER TABLE public.user_profiles
      DROP CONSTRAINT user_profiles_onboarding_step_check;
  END IF;

  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_onboarding_step_check
    CHECK (
      onboarding_step IS NULL OR
      onboarding_step IN ('privacy', 'usage', 'setup', 'baseline', 'brands', 'goal', 'done')
    );
END$$;
