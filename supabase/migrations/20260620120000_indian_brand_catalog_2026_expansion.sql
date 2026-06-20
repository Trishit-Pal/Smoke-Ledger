-- Expand the default brand catalog with current Indian-market cigarette brands
-- that were still missing as of June 2026 — most notably John Player Gold Leaf
-- (a major ITC brand), plus Charminar, Glamour, Silk Cut, and several popular
-- capsule/line-extension variants of brands already in the catalog.
--
-- Scope: cigarettes only (no bidis / other tobacco). Categories are constrained
-- to the existing set: budget | regular | premium | imported | other.
--
-- Prices are pack MRP (INR), curated for June 2026 and aligned with peer brands
-- in the same segment already present in this catalog (see the existing
-- 20260601120000 / 20260601000000 migrations and docs/catalog/2026-cigarette-mrp-sources.md
-- for the methodology). They are starting defaults — users can override any
-- price in Settings, and that override is preserved across catalog refreshes.
--
-- sort_order range 204-220 is chosen against the LIVE catalog (max applied
-- sort_order = 203). It also deliberately avoids 250-271, which an as-yet-
-- unapplied European-brands migration (20260605000000) reserves, so the two
-- cannot collide if both are pushed later.
--
-- Existing users pick these up on next boot: sync_default_brand_catalog() adds
-- the missing rows idempotently, and refresh_seed_prices_from_catalog() only
-- updates prices on variants the user has never priced (price_count = 0). The
-- client re-sync is gated by CATALOG_SYNC_VERSION (bumped to 2026.2 alongside
-- this migration) so every installed client re-runs the sync exactly once.

INSERT INTO smoke_seed.brand_catalog (sort_order, brand_name, category, variant_name, default_pack_size, avg_price_inr)
VALUES
  -- ITC line extensions
  (204, 'Gold Flake', 'regular', 'Super Star', 10, 220),
  (205, 'Gold Flake', 'regular', 'Indie Mint Burst', 10, 230),
  (206, 'Classic', 'regular', 'Ice Burst', 20, 360),
  (207, 'Classic', 'regular', 'Menthol Rush', 20, 360),
  -- ITC John Player Gold Leaf (was missing entirely)
  (208, 'John Player Gold Leaf', 'premium', 'Kings', 20, 360),
  (209, 'John Player Gold Leaf', 'premium', 'Lights', 20, 360),
  -- VST
  (210, 'Charminar', 'budget', 'Filter', 10, 110),
  (211, 'Charminar', 'budget', 'Special', 10, 115),
  (212, 'Glamour', 'regular', 'Superslims', 20, 320),
  (213, 'Glamour', 'regular', 'Lights', 20, 320),
  -- Imported / premium
  (214, 'Silk Cut', 'imported', 'Original', 20, 500),
  (215, 'Silk Cut', 'imported', 'Silver', 20, 510),
  -- Capstan by Pall Mall capsule range
  (216, 'Capstan', 'budget', 'Fresh', 10, 140),
  (217, 'Capstan', 'budget', 'Bold', 10, 140),
  -- Godfrey Phillips
  (218, 'Four Square', 'budget', 'Rich', 10, 150),
  (219, 'Four Square', 'budget', 'Gold', 10, 150),
  -- ITC
  (220, 'Navy Cut', 'regular', 'Special', 10, 200)
ON CONFLICT (sort_order) DO NOTHING;
