# 2026 cigarette MRP sources (India)

Last reviewed: 2026-06-20

## Purpose

Seed prices in `smoke_seed.brand_catalog` are **pack MRP in INR**. They are curated manually from public reporting—not fetched at runtime.

## Primary sources (Feb 2026 excise duty changes)

- [NDTV Profit — ITC/GPI price revisions](https://www.ndtvprofit.com/business/cigarette-prices-raised-by-itc-godfrey-phillips-check-new-rates-for-gold-flake-classic-marlboro-11013480)
- [Economic Times — excise impact overview](https://economictimes.indiatimes.com/industry/cons-products/tobacco/classic-gold-flake-or-marlboro-how-your-cigarette-bills-may-get-costlier-from-february-1/articleshow/126285158.cms)
- [Moneycontrol — per-pack increases](https://www.moneycontrol.com/news/business/companies/gold-flake-kings-to-wills-classic-milds-cigarette-prices-rise-rs-22-55-per-pack-as-new-excise-duty-kicks-in-13805538.html)

## Update process

1. Research revised MRPs after tax announcements.
2. Edit [`supabase/migrations/20260601000000_catalog_2026_refresh.sql`](../supabase/migrations/20260601000000_catalog_2026_refresh.sql) or add a new dated migration with `UPDATE smoke_seed.brand_catalog`.
3. Run `npm run db:push`.
4. Existing users: call `refresh_seed_prices_from_catalog()` (updates seed variants where `price_count = 0`) and `sync_default_brand_catalog()` for new rows.

## Display note

When `price_source` is `inferred` or `estimated`, UI may show “estimated from catalog” for transparency.

## 2026-06-20 expansion (`20260620120000_indian_brand_catalog_2026_expansion.sql`)

Added 17 rows (`sort_order` 204-220) for current Indian-market cigarette brands
that were still missing — most notably **John Player Gold Leaf** (a major ITC
brand absent from the catalog), plus **Charminar** and **Glamour** (VST), **Silk
Cut** (imported), and popular capsule/line-extension variants of existing brands
(Gold Flake Super Star / Indie Mint Burst, Classic Ice Burst / Menthol Rush,
Capstan Fresh / Bold, Four Square Rich / Gold, Navy Cut Special).

Prices are pack MRP (INR) curated for June 2026 and **aligned with peer brands in
the same segment** already in the catalog (same approach as the 20260601120000
Indian expansion) rather than a single citable per-brand source — treat them as
reasonable starting defaults. Users can override any price in Settings (Brand
catalog → edit price); overrides set `price_count = 1` so
`refresh_seed_prices_from_catalog()` never clobbers them.

Authored against the **live** catalog (max applied `sort_order` was 203). The
range deliberately avoids 250-271, reserved by the not-yet-applied European
migration `20260605000000`. Client re-sync forced by bumping
`CATALOG_SYNC_VERSION` → `2026.2`.
