-- Profile identity fields + 18+ age gate + immutability + mobile rate-limit (additive).
--
-- Adds the personal-identity columns collected at signup and the data-integrity
-- rules that protect them. All enforcement lives at the DB layer because the
-- user_profiles UPDATE RLS policy is permissive across columns (id = auth.uid());
-- per-column rules cannot be expressed in RLS, so a BEFORE UPDATE trigger owns them.
--
-- Touches:
--   1. user_profiles columns      — full_name, date_of_birth, gender, mobile_e164,
--                                    mobile_changed_at, place
--   2. CHECK constraints          — value sanity (enum, length, dob lower bound, E.164)
--   3. enforce_profile_identity_rules() BEFORE UPDATE trigger
--        - name / dob / gender are IMMUTABLE once set
--        - first-set dob must be 18+ (defense in depth for the completion path)
--        - mobile_e164 changeable at most once / 30 days; mobile_changed_at is
--          server-owned (client cannot tamper with the window)
--   4. handle_new_user()          — reads signup metadata (full_name/date_of_birth/
--                                    gender), HARD-blocks under-18 at account creation
--                                    (RAISE aborts the auth.users insert → no minor row)
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, guarded constraint adds, DROP TRIGGER IF
-- EXISTS before CREATE, CREATE OR REPLACE FUNCTION. Apply order: AFTER
-- 20260606000000_realtime_publications.sql.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS full_name         text,
  ADD COLUMN IF NOT EXISTS date_of_birth     date,
  ADD COLUMN IF NOT EXISTS gender            text,
  ADD COLUMN IF NOT EXISTS mobile_e164       text,
  ADD COLUMN IF NOT EXISTS mobile_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS place             text;

-- ---------------------------------------------------------------------------
-- 2. CHECK constraints (value sanity only — time-relative 18+ / upper bound is in
--    the trigger, since CHECK cannot use the non-immutable current_date).
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_gender_check') THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_gender_check
      CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'undisclosed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_full_name_len_check') THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_full_name_len_check
      CHECK (full_name IS NULL OR char_length(full_name) BETWEEN 1 AND 80);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_dob_lower_check') THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_dob_lower_check
      CHECK (date_of_birth IS NULL OR date_of_birth > DATE '1900-01-01');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_mobile_e164_check') THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_mobile_e164_check
      CHECK (mobile_e164 IS NULL OR mobile_e164 ~ '^\+[1-9][0-9]{7,14}$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_place_len_check') THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_place_len_check
      CHECK (place IS NULL OR char_length(place) <= 80);
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 3. Immutability + mobile rate-limit (BEFORE UPDATE)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_profile_identity_rules ()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Immutable identity: once a value is set (NOT NULL) it can never change.
  IF OLD.full_name IS NOT NULL AND NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    RAISE EXCEPTION 'identity_immutable: full_name' USING ERRCODE = '42501';
  END IF;
  IF OLD.date_of_birth IS NOT NULL AND NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
    RAISE EXCEPTION 'identity_immutable: date_of_birth' USING ERRCODE = '42501';
  END IF;
  IF OLD.gender IS NOT NULL AND NEW.gender IS DISTINCT FROM OLD.gender THEN
    RAISE EXCEPTION 'identity_immutable: gender' USING ERRCODE = '42501';
  END IF;

  -- First-set 18+ recheck (covers the legacy/admin "complete your profile" path).
  IF OLD.date_of_birth IS NULL AND NEW.date_of_birth IS NOT NULL THEN
    IF NEW.date_of_birth > (current_date - interval '18 years') THEN
      RAISE EXCEPTION 'underage' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Mobile number: change at most once per 30 days. The timestamp is server-owned
  -- so a client cannot forge an old mobile_changed_at to bypass the window.
  IF NEW.mobile_e164 IS DISTINCT FROM OLD.mobile_e164 THEN
    IF OLD.mobile_changed_at IS NOT NULL
       AND OLD.mobile_changed_at > now() - interval '30 days' THEN
      RAISE EXCEPTION 'mobile_rate_limited' USING ERRCODE = '54000';
    END IF;
    NEW.mobile_changed_at := now();
  ELSE
    NEW.mobile_changed_at := OLD.mobile_changed_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_identity_rules ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_identity_rules
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_identity_rules();

-- ---------------------------------------------------------------------------
-- 4. handle_new_user: populate identity from signup metadata + HARD 18+ gate
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_full_name text := nullif(btrim(NEW.raw_user_meta_data ->> 'full_name'), '');
  v_dob_text  text := nullif(NEW.raw_user_meta_data ->> 'date_of_birth', '');
  v_gender    text := nullif(NEW.raw_user_meta_data ->> 'gender', '');
  v_dob       date := NULL;
BEGIN
  -- Parse DOB defensively; malformed input becomes NULL (completion gate asks later).
  IF v_dob_text IS NOT NULL THEN
    BEGIN
      v_dob := v_dob_text::date;
    EXCEPTION
      WHEN others THEN v_dob := NULL;
    END;
    -- HARD 18+ gate at account creation: a minor's auth.users insert is rolled back
    -- entirely, so no account (and no email/phone row) is ever stored.
    IF v_dob IS NOT NULL AND v_dob > (current_date - interval '18 years') THEN
      RAISE EXCEPTION 'underage_signup' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Constrain gender to the allowed set; anything else is dropped to NULL.
  IF v_gender IS NOT NULL AND v_gender NOT IN ('male', 'female', 'other', 'undisclosed') THEN
    v_gender := NULL;
  END IF;

  -- Defensive length cap (the CHECK constraint also enforces this).
  IF v_full_name IS NOT NULL AND char_length(v_full_name) > 80 THEN
    v_full_name := left(v_full_name, 80);
  END IF;

  INSERT INTO public.user_profiles (id, full_name, date_of_birth, gender)
    VALUES (NEW.id, v_full_name, v_dob, v_gender)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.brands WHERE user_id = NEW.id
  ) THEN
    PERFORM smoke_seed.apply_default_brands(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
