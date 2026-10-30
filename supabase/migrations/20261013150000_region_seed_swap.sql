-- Currency changes reseed from the stored country, including a direct
-- user_profiles update. The BEFORE trigger is the gate. The AFTER trigger
-- swaps seeds only once that country is visible to market_for_user.

CREATE OR REPLACE FUNCTION public.enforce_profile_region()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_currency text;
  old_currency text;
BEGIN
  IF NEW.country IS NULL THEN
    new_currency := 'INR';
  ELSE
    SELECT r.currency INTO new_currency
      FROM smoke_seed.region r
      WHERE r.country = NEW.country;
    IF new_currency IS NULL THEN
      RAISE EXCEPTION 'unknown country' USING ERRCODE = '23514';
    END IF;
  END IF;
  NEW.currency := new_currency;

  IF TG_OP = 'UPDATE' AND NEW.country IS DISTINCT FROM OLD.country THEN
    IF OLD.country IS NULL THEN
      old_currency := 'INR';
    ELSE
      SELECT r.currency INTO old_currency
        FROM smoke_seed.region r
        WHERE r.country = OLD.country;
      IF old_currency IS NULL THEN
        old_currency := 'INR';
      END IF;
    END IF;
    IF new_currency IS DISTINCT FROM old_currency THEN
      IF EXISTS (SELECT 1 FROM public.cigarette_logs l WHERE l.user_id = NEW.id)
         OR EXISTS (
           SELECT 1 FROM public.brand_variants v
           WHERE v.user_id = NEW.id AND COALESCE(v.price_count, 0) > 0
         )
         OR EXISTS (
           SELECT 1 FROM public.goals g
           WHERE g.user_id = NEW.id
             AND g.type = 'spend_cap_daily'
         )
      THEN
        RAISE EXCEPTION 'region_change_requires_reset' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_profile_region() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.set_region(p_country text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  old_country text;
  old_currency text;
  new_currency text;
  blocked boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_country IS NULL OR NOT EXISTS (
    SELECT 1 FROM smoke_seed.region r WHERE r.country = p_country
  ) THEN
    RAISE EXCEPTION 'unknown country' USING ERRCODE = '23514';
  END IF;

  SELECT p.country INTO old_country
    FROM public.user_profiles p
   WHERE p.id = uid;

  IF old_country IS NULL THEN
    old_currency := 'INR';
  ELSE
    SELECT r.currency INTO old_currency
      FROM smoke_seed.region r
     WHERE r.country = old_country;
    IF old_currency IS NULL THEN
      old_currency := 'INR';
    END IF;
  END IF;

  SELECT r.currency INTO new_currency
    FROM smoke_seed.region r
   WHERE r.country = p_country;

  blocked := EXISTS (SELECT 1 FROM public.cigarette_logs l WHERE l.user_id = uid)
    OR EXISTS (
      SELECT 1 FROM public.brand_variants v
       WHERE v.user_id = uid AND COALESCE(v.price_count, 0) > 0
    )
    OR EXISTS (
      SELECT 1 FROM public.goals g
       WHERE g.user_id = uid
         AND g.type = 'spend_cap_daily'
    );

  -- currency-swap:begin
  IF new_currency IS DISTINCT FROM old_currency AND NOT blocked THEN
    DELETE FROM public.brand_variants v
     USING public.brands b
     WHERE v.brand_id = b.id
       AND v.user_id = uid
       AND b.user_id = uid
       AND b.is_seed = true;

    DELETE FROM public.brands
     WHERE user_id = uid AND is_seed = true;
  END IF;
  -- currency-swap:end

  UPDATE public.user_profiles
     SET country = p_country
   WHERE id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_missing' USING ERRCODE = 'P0001';
  END IF;

  PERFORM smoke_seed.apply_default_brands(uid);
END;
$$;

REVOKE ALL ON FUNCTION public.set_region(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_region(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.swap_seeds_after_region_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.currency IS DISTINCT FROM OLD.currency THEN
    DELETE FROM public.brand_variants v
     USING public.brands b
     WHERE v.brand_id = b.id
       AND v.user_id = NEW.id
       AND b.user_id = NEW.id
       AND b.is_seed = true;

    DELETE FROM public.brands
     WHERE user_id = NEW.id AND is_seed = true;

    PERFORM smoke_seed.apply_default_brands(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.swap_seeds_after_region_change() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_user_profiles_seed_swap ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_seed_swap
  AFTER UPDATE OF country ON public.user_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.swap_seeds_after_region_change();
