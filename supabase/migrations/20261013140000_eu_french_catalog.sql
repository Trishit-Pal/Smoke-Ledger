-- EU market seed. Prices are French legal retail for a 20-stick pack, in euros,
-- stored in avg_price_inr (the column name is historical). One price for every
-- EU country. Source: nomenclature in force 1 September 2026,
-- https://www.douane.gouv.fr/sites/default/files/2026-08/12/Maquette%20JORF%201er%20septembre%202026.pdf
--
-- Omitted (no French legal cigarette pack price, or banned):
--   JPS Silver, Embassy Filter, Lord Extra, HB, R1, MS Blu, Diana Rossa,
--   Ducados, Nobel, Prince, LD, Karelia, Sobranie Cocktail.
--   Vogue Menthe: characterising flavours, including menthol, have been banned
--   on EU cigarettes since 20 May 2020 (Directive 2014/40/EU, Article 7).
-- Pall Mall is not seeded here: the French list has no Pall Mall cigarette
-- 20-pack, so there is no legal pack price to store.

INSERT INTO smoke_seed.brand_catalog (
  sort_order, brand_name, category, variant_name, default_pack_size, avg_price_inr, market
) VALUES
  (272, 'JPS', 'regular', 'Classic Black', 20, 13.00, 'EU'),
  (273, 'Mayfair', 'regular', 'King Size', 20, 13.10, 'EU'),
  (274, 'Vogue', 'regular', 'L''Originale Bleue', 20, 13.50, 'EU'),
  (275, 'Lambert & Butler', 'regular', 'Lambert & Butler', 20, 13.10, 'EU'),
  (276, 'Gitanes', 'regular', 'Filtre', 20, 14.60, 'EU'),
  (277, 'Gauloises', 'regular', 'Brunes', 20, 14.20, 'EU'),
  (278, 'Royale', 'regular', 'Rouge', 20, 13.20, 'EU'),
  (279, 'Fortuna', 'regular', 'Rouge', 20, 11.40, 'EU'),
  (280, 'Marlboro', 'premium', 'Red', 20, 13.50, 'EU'),
  (281, 'Camel', 'premium', 'Filters', 20, 13.00, 'EU'),
  (282, 'Winston', 'regular', 'Blue', 20, 13.00, 'EU'),
  (283, 'Lucky Strike', 'premium', 'Original Red', 20, 13.00, 'EU'),
  (284, 'Chesterfield', 'regular', 'Original Red', 20, 13.00, 'EU'),
  (285, 'L&M', 'regular', 'International Red', 20, 13.00, 'EU')
ON CONFLICT (sort_order) DO NOTHING;

-- Median of the 14 pack prices above is 13.05 EUR. Per stick: 0.6525.
UPDATE smoke_seed.region SET stick_hint = 0.6525 WHERE market = 'EU';

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
         AND g.status = 'active'
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

  PERFORM smoke_seed.apply_default_brands(uid);
END;
$$;

REVOKE ALL ON FUNCTION public.set_region(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_region(text) TO authenticated;
