-- Expand default brand catalog with missing Indian cigarette brands (ITC, GPI, VST, NTC, regional).
-- Prices are estimated pack MRP (INR) aligned with peer brands in the same segment.
-- Existing users: sync_default_brand_catalog() adds missing rows idempotently.

INSERT INTO smoke_seed.brand_catalog (sort_order, brand_name, category, variant_name, default_pack_size, avg_price_inr)
VALUES
  -- ITC
  (166, 'Wills Classic', 'regular', 'Regular', 10, 240),
  (167, 'Wills Classic', 'regular', 'Milds', 10, 250),
  (168, 'Classic Milds', 'regular', 'Regular', 10, 250),
  (169, 'Classic Milds', 'regular', 'Ultra Milds', 10, 260),
  -- Godfrey Phillips
  (170, 'I-GEN', 'budget', 'Regular', 10, 120),
  (171, 'I-GEN', 'budget', 'King Size', 10, 125),
  (172, 'Focus', 'budget', 'Regular', 10, 115),
  (173, 'Focus', 'budget', 'Filter', 10, 120),
  (174, 'Club One', 'budget', 'Regular', 10, 110),
  (175, 'Club One', 'budget', 'King Size', 10, 115),
  (176, 'Cavanders', 'budget', 'Regular', 10, 125),
  (177, 'Cavanders', 'budget', 'Filter', 10, 130),
  (178, 'Originals', 'regular', 'Regular', 10, 130),
  (179, 'Originals', 'regular', 'Premium', 10, 140),
  (180, 'North Pole', 'budget', 'Regular', 10, 105),
  (181, 'North Pole', 'budget', 'Filter', 10, 110),
  (182, 'Tipper', 'budget', 'Regular', 10, 100),
  (183, 'Tipper', 'budget', 'King Size', 10, 105),
  -- Golden Tobacco
  (184, 'Golden Gold', 'budget', 'Regular', 10, 120),
  (185, 'Golden Gold', 'budget', 'Virginia', 10, 125),
  (186, 'Chancellor', 'budget', 'Regular', 10, 115),
  (187, 'Chancellor', 'budget', 'Filter', 10, 120),
  -- VST Industries
  (188, 'Moments', 'regular', 'Regular', 10, 170),
  (189, 'Moments', 'regular', 'Filter', 10, 175),
  (190, 'Total', 'premium', 'Regular', 20, 420),
  (191, 'Total', 'premium', 'Premium Blend', 20, 430),
  -- NTC Industries
  (192, 'Duke', 'budget', 'Regular', 10, 110),
  (193, 'Duke', 'budget', 'Filter', 10, 115),
  (194, 'Bull', 'budget', 'Regular', 10, 105),
  (195, 'Bull', 'budget', 'King Size', 10, 110),
  (196, 'Casino', 'regular', 'Regular', 10, 130),
  (197, 'Casino', 'regular', 'Filter', 10, 135),
  -- Regional / legacy
  (198, 'Maypole', 'budget', 'Regular', 10, 100),
  (199, 'Maypole', 'budget', 'Filter', 10, 105),
  (200, 'First Lady', 'budget', 'Regular', 10, 105),
  (201, 'First Lady', 'budget', 'Filter', 10, 110),
  (202, 'La Rose', 'budget', 'Regular', 10, 100),
  (203, 'La Rose', 'budget', 'King Size', 10, 105)
ON CONFLICT (sort_order) DO NOTHING;
