-- 2026 catalog refresh: updated MRPs (post Feb 2026 excise duty) + new brands.
-- Sources documented in docs/catalog/2026-cigarette-mrp-sources.md
-- avg_price_inr = pack MRP in INR at seed time.

-- Refresh existing seed catalog prices
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 230 WHERE sort_order = 1;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 150 WHERE sort_order = 2;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 220 WHERE sort_order = 3;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 240 WHERE sort_order = 4;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 250 WHERE sort_order = 5;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 260 WHERE sort_order = 6;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 195 WHERE sort_order = 7;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 140 WHERE sort_order = 8;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 460 WHERE sort_order = 9;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 460 WHERE sort_order = 10;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 470 WHERE sort_order = 11;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 490 WHERE sort_order = 12;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 520 WHERE sort_order = 13;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 520 WHERE sort_order = 14;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 195 WHERE sort_order = 15;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 130 WHERE sort_order = 16;

UPDATE smoke_seed.brand_catalog SET avg_price_inr = 165 WHERE sort_order = 100;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 170 WHERE sort_order = 101;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 145 WHERE sort_order = 102;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 150 WHERE sort_order = 103;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 135 WHERE sort_order = 104;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 140 WHERE sort_order = 105;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 120 WHERE sort_order = 106;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 130 WHERE sort_order = 107;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 155 WHERE sort_order = 108;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 165 WHERE sort_order = 109;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 400 WHERE sort_order = 110;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 400 WHERE sort_order = 111;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 380 WHERE sort_order = 112;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 380 WHERE sort_order = 113;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 360 WHERE sort_order = 114;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 360 WHERE sort_order = 115;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 350 WHERE sort_order = 116;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 350 WHERE sort_order = 117;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 360 WHERE sort_order = 118;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 360 WHERE sort_order = 119;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 420 WHERE sort_order = 120;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 420 WHERE sort_order = 121;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 430 WHERE sort_order = 122;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 440 WHERE sort_order = 123;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 500 WHERE sort_order = 124;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 510 WHERE sort_order = 125;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 450 WHERE sort_order = 126;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 460 WHERE sort_order = 127;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 430 WHERE sort_order = 128;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 440 WHERE sort_order = 129;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 520 WHERE sort_order = 130;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 530 WHERE sort_order = 131;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 540 WHERE sort_order = 132;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 490 WHERE sort_order = 133;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 500 WHERE sort_order = 134;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 470 WHERE sort_order = 135;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 480 WHERE sort_order = 136;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 490 WHERE sort_order = 137;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 500 WHERE sort_order = 138;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 600 WHERE sort_order = 139;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 600 WHERE sort_order = 140;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 520 WHERE sort_order = 141;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 530 WHERE sort_order = 142;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 580 WHERE sort_order = 143;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 600 WHERE sort_order = 144;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 540 WHERE sort_order = 145;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 550 WHERE sort_order = 146;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 580 WHERE sort_order = 147;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 580 WHERE sort_order = 148;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 380 WHERE sort_order = 149;
UPDATE smoke_seed.brand_catalog SET avg_price_inr = 390 WHERE sort_order = 150;

INSERT INTO smoke_seed.brand_catalog (sort_order, brand_name, category, variant_name, default_pack_size, avg_price_inr)
VALUES
  (151, 'Gold Flake', 'regular', 'Neo', 10, 210),
  (152, 'Classic', 'regular', 'Connect', 20, 350),
  (153, 'Classic', 'regular', 'Connect Slims', 20, 350),
  (154, 'American Club', 'budget', 'Regular', 10, 125),
  (155, 'Scissors', 'budget', 'Filter', 10, 115),
  (156, 'Players', 'regular', 'Original', 10, 175),
  (157, 'Stellar', 'budget', 'King Size', 10, 110),
  (158, 'Flake', 'regular', 'Original', 10, 180),
  (159, 'Marlboro', 'premium', 'Fusion', 20, 480),
  (160, 'Marlboro', 'premium', 'Filter Plus', 20, 470),
  (161, 'American Spirit', 'premium', 'Organic', 20, 520),
  (162, '555', 'premium', 'State Express', 20, 440),
  (163, 'Pine', 'budget', 'Filter', 10, 105),
  (164, 'India Kings', 'premium', 'Classic', 20, 450),
  (165, 'Editions', 'premium', 'Premium Blend', 20, 430)
ON CONFLICT (sort_order) DO NOTHING;

CREATE OR REPLACE FUNCTION smoke_seed.refresh_seed_prices_from_catalog()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = smoke_seed, public
AS $$
BEGIN
  UPDATE public.brand_variants bv
  SET
    avg_price_inr = bc.avg_price_inr,
    last_price_inr = bc.avg_price_inr
  FROM public.brands b,
       smoke_seed.brand_catalog bc
  WHERE bv.brand_id = b.id
    AND b.is_seed = true
    AND b.name = bc.brand_name
    AND bv.name = bc.variant_name
    AND COALESCE(bv.price_count, 0) = 0;
END;
$$;

REVOKE ALL ON FUNCTION smoke_seed.refresh_seed_prices_from_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION smoke_seed.refresh_seed_prices_from_catalog() TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_seed_prices_from_catalog()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = smoke_seed, public
AS $$
  SELECT smoke_seed.refresh_seed_prices_from_catalog();
$$;

REVOKE ALL ON FUNCTION public.refresh_seed_prices_from_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_seed_prices_from_catalog() TO authenticated;
