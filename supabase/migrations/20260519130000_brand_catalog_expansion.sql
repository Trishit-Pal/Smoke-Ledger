-- Expand default brand catalog and allow existing users to sync missing entries.

INSERT INTO smoke_seed.brand_catalog (
  sort_order,
  brand_name,
  category,
  variant_name,
  default_pack_size,
  avg_price_inr
)
VALUES
  (100, 'Red & White', 'budget', 'Regular', 10, 135),
  (101, 'Red & White', 'budget', 'Menthol', 10, 140),
  (102, 'Panama', 'budget', 'Virginia', 10, 120),
  (103, 'Panama', 'budget', 'Classic', 10, 125),
  (104, 'Berkeley', 'budget', 'Original', 10, 110),
  (105, 'Berkeley', 'budget', 'King Size', 10, 115),
  (106, 'Charms', 'budget', 'Regular', 10, 95),
  (107, 'Charms', 'budget', 'Filter', 10, 105),
  (108, 'Bristol', 'regular', 'Classic', 10, 130),
  (109, 'Bristol', 'regular', 'Gold', 10, 140),
  (110, 'Rothmans', 'regular', 'Kings', 20, 340),
  (111, 'Rothmans', 'regular', 'Blue', 20, 340),
  (112, 'Winston', 'regular', 'Classic', 20, 320),
  (113, 'Winston', 'regular', 'Blue', 20, 320),
  (114, 'L&M', 'regular', 'Red', 20, 300),
  (115, 'L&M', 'regular', 'Blue', 20, 300),
  (116, 'Pall Mall', 'regular', 'Red', 20, 290),
  (117, 'Pall Mall', 'regular', 'Blue', 20, 290),
  (118, 'Chesterfield', 'regular', 'Original', 20, 300),
  (119, 'Chesterfield', 'regular', 'Blue', 20, 300),
  (120, 'Camel', 'premium', 'Filters', 20, 360),
  (121, 'Camel', 'premium', 'Blue', 20, 360),
  (122, 'Lucky Strike', 'premium', 'Original Red', 20, 370),
  (123, 'Lucky Strike', 'premium', 'Double Click', 20, 380),
  (124, 'Parliament', 'premium', 'Aqua Blue', 20, 430),
  (125, 'Parliament', 'premium', 'Night Blue', 20, 440),
  (126, 'Kent', 'premium', 'Nanotek', 20, 390),
  (127, 'Kent', 'premium', 'Switch', 20, 400),
  (128, 'Mevius', 'premium', 'Original', 20, 370),
  (129, 'Mevius', 'premium', 'Lights', 20, 380),
  (130, 'Davidoff', 'premium', 'Classic', 20, 450),
  (131, 'Davidoff', 'premium', 'Gold', 20, 460),
  (132, 'Davidoff', 'premium', 'Menthol', 20, 470),
  (133, 'Esse', 'premium', 'Lights', 20, 420),
  (134, 'Esse', 'premium', 'Change', 20, 430),
  (135, 'Marlboro', 'premium', 'Double Burst', 20, 390),
  (136, 'Marlboro', 'premium', 'Crafted', 20, 400),
  (137, 'Benson & Hedges', 'premium', 'Blue', 20, 420),
  (138, 'Benson & Hedges', 'premium', 'Special Filter', 20, 430),
  (139, 'Sobranie', 'imported', 'Black Russian', 20, 520),
  (140, 'Sobranie', 'imported', 'White Russian', 20, 520),
  (141, 'Dunhill', 'imported', 'Fine Cut', 20, 450),
  (142, 'Dunhill', 'imported', 'International', 20, 460),
  (143, 'Gudang Garam', 'imported', 'Surya', 20, 500),
  (144, 'Gudang Garam', 'imported', 'Signature', 20, 520),
  (145, 'Mild Seven', 'imported', 'Original', 20, 470),
  (146, 'Mild Seven', 'imported', 'Super Lights', 20, 480),
  (147, 'Gauloises', 'imported', 'Blondes', 20, 500),
  (148, 'Gauloises', 'imported', 'Blue', 20, 500),
  (149, 'West', 'regular', 'Original', 20, 320),
  (150, 'West', 'regular', 'Ice', 20, 330)
ON CONFLICT (sort_order) DO NOTHING;

CREATE OR REPLACE FUNCTION smoke_seed.sync_catalog_for_user (target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = smoke_seed, public
AS $$
DECLARE
  r record;
  existing_brand_id text;
BEGIN
  FOR r IN
    SELECT *
    FROM smoke_seed.brand_catalog
    ORDER BY sort_order
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
        id,
        user_id,
        name,
        category,
        is_seed,
        is_favorite,
        created_at,
        updated_at
      )
      VALUES (
        existing_brand_id,
        target_user,
        r.brand_name,
        r.category,
        true,
        false,
        now(),
        now()
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
        id,
        user_id,
        brand_id,
        name,
        default_pack_size,
        avg_price_inr,
        last_price_inr,
        last_priced_at
      )
      VALUES (
        'var_' || replace(gen_random_uuid()::text, '-', ''),
        target_user,
        existing_brand_id,
        r.variant_name,
        r.default_pack_size,
        r.avg_price_inr,
        r.avg_price_inr,
        now()
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_default_brand_catalog ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, smoke_seed
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM smoke_seed.sync_catalog_for_user(uid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_default_brand_catalog() TO authenticated;
