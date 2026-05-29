-- Expand default brand catalog with international (especially European) cigarette brands as of 2026.
-- All entries category='imported' (peer to existing Sobranie/Dunhill/Mild Seven/Gauloises rows).
-- Pricing is the typical Indian-market MRP for the imported segment post Feb-2026 excise duty:
-- 20-stick packs in the 450-560 INR band, mirroring existing imported peers.
-- De-duped against sort_orders 1-16 (initial), 100-150 (international expansion),
-- 151-165 (2026 refresh variants), and 166-203 (Indian expansion). Range 250-271 is clear.
-- Existing users pick up the rows on next session boot via public.sync_default_brand_catalog().

INSERT INTO smoke_seed.brand_catalog (sort_order, brand_name, category, variant_name, default_pack_size, avg_price_inr)
VALUES
  -- United Kingdom (Imperial / BAT / JTI)
  (250, 'JPS', 'imported', 'Black', 20, 460),
  (251, 'JPS', 'imported', 'Silver', 20, 470),
  (252, 'Embassy', 'imported', 'Filter', 20, 470),
  (253, 'Mayfair', 'imported', 'King Size', 20, 450),
  (254, 'Vogue', 'imported', 'Bleue', 20, 530),
  (255, 'Vogue', 'imported', 'Menthe', 20, 540),
  (256, 'Lambert & Butler', 'imported', 'Original Silver', 20, 470),
  -- Germany (Reemtsma / JTI Germany)
  (257, 'Lord', 'imported', 'Extra', 20, 460),
  (258, 'HB', 'imported', 'Filter', 20, 460),
  (259, 'R1', 'imported', 'Slim', 20, 510),
  -- France (Imperial Tabac / Seita)
  (260, 'Gitanes', 'imported', 'Brunes', 20, 520),
  (261, 'Royale', 'imported', 'Filtre', 20, 490),
  -- Italy (JTI Italy / Manifatture Sigaro Toscano)
  (262, 'MS', 'imported', 'Blu', 20, 480),
  (263, 'Diana', 'imported', 'Rossa', 20, 470),
  -- Spain (Altadis / Imperial)
  (264, 'Ducados', 'imported', 'Original', 20, 470),
  (265, 'Fortuna', 'imported', 'Red', 20, 470),
  (266, 'Nobel', 'imported', 'Classic', 20, 460),
  -- Nordics (House of Prince / JTI Sweden)
  (267, 'Prince', 'imported', 'Rich Taste', 20, 510),
  (268, 'LD', 'imported', 'Blue', 20, 470),
  -- Greece (Karelia Tobacco)
  (269, 'Karelia', 'imported', 'Slims', 20, 540),
  (270, 'Karelia', 'imported', 'Classic', 20, 540),
  -- New variant on already-seeded Sobranie row (139-140: Black Russian / White Russian).
  -- sync_catalog_for_user keys brand uniqueness by lower(brand_name), so this attaches
  -- to the existing Sobranie brand record and only inserts the variant.
  (271, 'Sobranie', 'imported', 'Cocktail', 20, 560)
ON CONFLICT (sort_order) DO NOTHING;
