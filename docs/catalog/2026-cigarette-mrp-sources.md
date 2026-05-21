# 2026 cigarette MRP sources (India)

Last reviewed: 2026-05-20

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
