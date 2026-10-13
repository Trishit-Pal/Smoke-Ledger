-- Country → currency. NULL country stays the India / INR ledger.
-- Amount columns named *_inr store major units of user_profiles.currency.
-- EU catalog prices are not inserted here: stick hints stay null until cited.

CREATE TABLE IF NOT EXISTS smoke_seed.region (
  country text PRIMARY KEY,
  currency text NOT NULL,
  market text NOT NULL,
  locale text NOT NULL,
  timezone text NOT NULL,
  stick_hint numeric
);

-- region-rows:begin
INSERT INTO smoke_seed.region (country, currency, market, locale, timezone, stick_hint) VALUES
  ('IN', 'INR', 'IN', 'en-IN', 'Asia/Kolkata', 18),
  ('AT', 'EUR', 'EU', 'de-AT', 'Europe/Vienna', NULL),
  ('BE', 'EUR', 'EU', 'nl-BE', 'Europe/Brussels', NULL),
  ('BG', 'EUR', 'EU', 'bg-BG', 'Europe/Sofia', NULL),
  ('HR', 'EUR', 'EU', 'hr-HR', 'Europe/Zagreb', NULL),
  ('CY', 'EUR', 'EU', 'el-CY', 'Asia/Nicosia', NULL),
  ('CZ', 'EUR', 'EU', 'cs-CZ', 'Europe/Prague', NULL),
  ('DK', 'EUR', 'EU', 'da-DK', 'Europe/Copenhagen', NULL),
  ('EE', 'EUR', 'EU', 'et-EE', 'Europe/Tallinn', NULL),
  ('FI', 'EUR', 'EU', 'fi-FI', 'Europe/Helsinki', NULL),
  ('FR', 'EUR', 'EU', 'fr-FR', 'Europe/Paris', NULL),
  ('DE', 'EUR', 'EU', 'de-DE', 'Europe/Berlin', NULL),
  ('GR', 'EUR', 'EU', 'el-GR', 'Europe/Athens', NULL),
  ('HU', 'EUR', 'EU', 'hu-HU', 'Europe/Budapest', NULL),
  ('IE', 'EUR', 'EU', 'en-IE', 'Europe/Dublin', NULL),
  ('IT', 'EUR', 'EU', 'it-IT', 'Europe/Rome', NULL),
  ('LV', 'EUR', 'EU', 'lv-LV', 'Europe/Riga', NULL),
  ('LT', 'EUR', 'EU', 'lt-LT', 'Europe/Vilnius', NULL),
  ('LU', 'EUR', 'EU', 'fr-LU', 'Europe/Luxembourg', NULL),
  ('MT', 'EUR', 'EU', 'en-MT', 'Europe/Malta', NULL),
  ('NL', 'EUR', 'EU', 'nl-NL', 'Europe/Amsterdam', NULL),
  ('PL', 'EUR', 'EU', 'pl-PL', 'Europe/Warsaw', NULL),
  ('PT', 'EUR', 'EU', 'pt-PT', 'Europe/Lisbon', NULL),
  ('RO', 'EUR', 'EU', 'ro-RO', 'Europe/Bucharest', NULL),
  ('SK', 'EUR', 'EU', 'sk-SK', 'Europe/Bratislava', NULL),
  ('SI', 'EUR', 'EU', 'sl-SI', 'Europe/Ljubljana', NULL),
  ('ES', 'EUR', 'EU', 'es-ES', 'Europe/Madrid', NULL),
  ('SE', 'EUR', 'EU', 'sv-SE', 'Europe/Stockholm', NULL)
ON CONFLICT (country) DO NOTHING;
-- region-rows:end

ALTER TABLE smoke_seed.region DROP CONSTRAINT IF EXISTS region_currency_check;
ALTER TABLE smoke_seed.region
  ADD CONSTRAINT region_currency_check CHECK (currency IN ('INR', 'EUR')) NOT VALID;
ALTER TABLE smoke_seed.region VALIDATE CONSTRAINT region_currency_check;

ALTER TABLE smoke_seed.region DROP CONSTRAINT IF EXISTS region_market_check;
ALTER TABLE smoke_seed.region
  ADD CONSTRAINT region_market_check CHECK (market IN ('IN', 'EU')) NOT VALID;
ALTER TABLE smoke_seed.region VALIDATE CONSTRAINT region_market_check;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS country text;

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_country_fkey;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_country_fkey
  FOREIGN KEY (country) REFERENCES smoke_seed.region (country);

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_currency_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_currency_check CHECK (currency IN ('INR', 'EUR')) NOT VALID;
ALTER TABLE public.user_profiles VALIDATE CONSTRAINT user_profiles_currency_check;

COMMENT ON COLUMN public.cigarette_logs.total_price_inr IS
  'Major units of user_profiles.currency. The column name is historical.';
COMMENT ON COLUMN public.cigarette_logs.unit_price_inr IS
  'Major units of user_profiles.currency. The column name is historical.';

ALTER TABLE smoke_seed.brand_catalog
  ADD COLUMN IF NOT EXISTS market text NOT NULL DEFAULT 'IN';

ALTER TABLE smoke_seed.brand_catalog DROP CONSTRAINT IF EXISTS brand_catalog_market_check;
ALTER TABLE smoke_seed.brand_catalog
  ADD CONSTRAINT brand_catalog_market_check CHECK (market IN ('IN', 'EU')) NOT VALID;
ALTER TABLE smoke_seed.brand_catalog VALIDATE CONSTRAINT brand_catalog_market_check;

CREATE UNIQUE INDEX IF NOT EXISTS brand_catalog_market_name_variant_uidx
  ON smoke_seed.brand_catalog (market, lower(brand_name), lower(variant_name));

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
             AND g.status = 'active'
         )
      THEN
        RAISE EXCEPTION 'region_change_requires_reset' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_region ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_region
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_profile_region();

CREATE OR REPLACE FUNCTION smoke_seed.market_for_user(target_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT r.market
       FROM public.user_profiles p
       JOIN smoke_seed.region r ON r.country = p.country
      WHERE p.id = target_user),
    'IN'
  );
$$;

REVOKE ALL ON FUNCTION smoke_seed.market_for_user(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION smoke_seed.apply_default_brands(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cur_brand text := '';
  cur_brand_id text;
  r record;
  mkt text := smoke_seed.market_for_user(target_user);
BEGIN
  FOR r IN
    SELECT *
    FROM smoke_seed.brand_catalog
    WHERE market = mkt
    ORDER BY sort_order
  LOOP
    IF cur_brand IS DISTINCT FROM r.brand_name THEN
      cur_brand := r.brand_name;
      SELECT b.id INTO cur_brand_id
        FROM public.brands b
        WHERE b.user_id = target_user
          AND lower(b.name) = lower(r.brand_name)
        ORDER BY b.created_at ASC
        LIMIT 1;
      IF cur_brand_id IS NULL THEN
        cur_brand_id := 'brd_' || replace(gen_random_uuid()::text, '-', '');
        INSERT INTO public.brands (
          id, user_id, name, category, is_seed, is_favorite, created_at, updated_at
        ) VALUES (
          cur_brand_id, target_user, r.brand_name, r.category, true, false, now(), now()
        );
      END IF;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.brand_variants v
      WHERE v.user_id = target_user
        AND v.brand_id = cur_brand_id
        AND lower(v.name) = lower(r.variant_name)
    ) THEN
      INSERT INTO public.brand_variants (
        id, user_id, brand_id, name, default_pack_size, avg_price_inr, last_price_inr, last_priced_at
      ) VALUES (
        'var_' || replace(gen_random_uuid()::text, '-', ''),
        target_user, cur_brand_id, r.variant_name,
        r.default_pack_size, r.avg_price_inr, r.avg_price_inr, now()
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION smoke_seed.apply_default_brands(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION smoke_seed.sync_catalog_for_user(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  existing_brand_id text;
  mkt text := smoke_seed.market_for_user(target_user);
BEGIN
  FOR r IN
    SELECT * FROM smoke_seed.brand_catalog WHERE market = mkt ORDER BY sort_order
  LOOP
    SELECT b.id INTO existing_brand_id
      FROM public.brands b
      WHERE b.user_id = target_user
        AND lower(b.name) = lower(r.brand_name)
      ORDER BY b.created_at
      LIMIT 1;

    IF existing_brand_id IS NULL THEN
      existing_brand_id := 'brd_' || replace(gen_random_uuid()::text, '-', '');
      INSERT INTO public.brands (
        id, user_id, name, category, is_seed, is_favorite, created_at, updated_at
      ) VALUES (
        existing_brand_id, target_user, r.brand_name, r.category, true, false, now(), now()
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.brand_variants v
      WHERE v.user_id = target_user
        AND v.brand_id = existing_brand_id
        AND lower(v.name) = lower(r.variant_name)
    ) THEN
      INSERT INTO public.brand_variants (
        id, user_id, brand_id, name, default_pack_size, avg_price_inr, last_price_inr, last_priced_at
      ) VALUES (
        'var_' || replace(gen_random_uuid()::text, '-', ''),
        target_user, existing_brand_id, r.variant_name,
        r.default_pack_size, r.avg_price_inr, r.avg_price_inr, now()
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION smoke_seed.sync_catalog_for_user(uuid) FROM PUBLIC;

DROP FUNCTION IF EXISTS smoke_seed.refresh_seed_prices_from_catalog();

CREATE OR REPLACE FUNCTION smoke_seed.refresh_seed_prices_from_catalog(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mkt text := smoke_seed.market_for_user(target_user);
BEGIN
  UPDATE public.brand_variants bv
  SET
    avg_price_inr = bc.avg_price_inr,
    last_price_inr = bc.avg_price_inr
  FROM public.brands b,
       smoke_seed.brand_catalog bc
  WHERE bv.brand_id = b.id
    AND b.user_id = target_user
    AND bv.user_id = target_user
    AND b.is_seed = true
    AND b.name = bc.brand_name
    AND bv.name = bc.variant_name
    AND bc.market = mkt
    AND COALESCE(bv.price_count, 0) = 0;
END;
$$;

REVOKE ALL ON FUNCTION smoke_seed.refresh_seed_prices_from_catalog(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION smoke_seed.refresh_seed_prices_from_catalog(uuid) TO service_role;

DROP FUNCTION IF EXISTS public.refresh_seed_prices_from_catalog();

CREATE OR REPLACE FUNCTION public.refresh_seed_prices_from_catalog()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  PERFORM smoke_seed.refresh_seed_prices_from_catalog(uid);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_seed_prices_from_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_seed_prices_from_catalog() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_region(p_country text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_country IS NULL OR NOT EXISTS (
    SELECT 1 FROM smoke_seed.region r WHERE r.country = p_country
  ) THEN
    RAISE EXCEPTION 'unknown country' USING ERRCODE = '23514';
  END IF;
  UPDATE public.user_profiles
     SET country = p_country
   WHERE id = uid;
  PERFORM smoke_seed.apply_default_brands(uid);
END;
$$;

REVOKE ALL ON FUNCTION public.set_region(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_region(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_ledger_for_region(p_country text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_country IS NULL OR NOT EXISTS (
    SELECT 1 FROM smoke_seed.region r WHERE r.country = p_country
  ) THEN
    RAISE EXCEPTION 'unknown country' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.cigarette_logs WHERE user_id = uid;
  DELETE FROM public.price_entries WHERE user_id = uid;
  DELETE FROM public.goals
   WHERE user_id = uid AND type = 'spend_cap_daily';

  UPDATE public.brand_variants
     SET price_sum_inr = 0,
         price_count = 0,
         avg_price_inr = NULL,
         last_price_inr = NULL,
         last_priced_at = NULL
   WHERE user_id = uid;

  DELETE FROM public.brand_variants v
   USING public.brands b
   WHERE v.brand_id = b.id
     AND v.user_id = uid
     AND b.user_id = uid
     AND b.is_seed = true;

  DELETE FROM public.brands
   WHERE user_id = uid AND is_seed = true;

  UPDATE public.user_profiles
     SET country = p_country
   WHERE id = uid;

  PERFORM smoke_seed.apply_default_brands(uid);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_ledger_for_region(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_ledger_for_region(text) TO authenticated;
