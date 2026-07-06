# Migration ledger map — repo files ↔ live `schema_migrations`

**Audited 2026-07-05** against live project `tvcwrsglceahkjnfuzkn` (read-only:
`list_migrations` + object-level catalog checks). Migrations applied via
MCP/dashboard get **re-stamped** with the apply-time version, so
`supabase migration list` shows false "local-only" rows. This file is the
canonical mapping; trust object checks, not the ledger alone.

## Verdict

**Every repo migration's effects are live.** All drift is cosmetic
(re-stamped versions or consolidated applies). No missing DDL as of this audit.

## Exact-match rows (same version in repo and ledger)

`20250426120000`, `20260504000000`, `20260519100000`, `20260519130000`,
`20260520000000`, `20260521000000`, `20260523081444`, `20260523092053`,
`20260523092236`, `20260523171527`, `20260524050357`, `20260531075255`,
`20260531080049`, `20260601000000`, `20260601120000`, `20260616181124`.

## Re-stamped rows (repo version → live ledger version)

| Repo file | Live ledger row |
|---|---|
| `20260602000000_perf_rls_initplan_indexes` | `20260524095330_perf_rls_initplan_indexes` |
| `20260619000000_error_events_compliance_check` | `20260619075741_error_events_compliance_check` |
| `20260619180000_rate_limit_counters_explicit_deny` | `20260619180348_rate_limit_counters_explicit_deny` |
| `20260620120000_indian_brand_catalog_2026_expansion` | `20260619191800_indian_brand_catalog_2026_expansion` |
| `20260620130000_realtime_enable` | `20260620071018_realtime_enable` |
| `20260621000000_daily_summary_sum_quantity` | `20260621181116_daily_summary_sum_quantity` |
| `20260622000000_realtime_brands` | `20260622021837_realtime_brands` |
| `20260626120000_rate_limit_window_created_at` | `20260626141028_rate_limit_window_created_at` |
| `20260628120000_facts_cravings` + `20260629000001_facts_cravings_category` | `20260629030944_facts_cravings` (consolidated) |
| `20260629000000_erase_pepper_guard` | `20260629030955_erase_pepper_guard` |

## Ledger rows with no same-version repo file (all accounted for above)

`20260524062010_indian_brand_catalog_expansion` — early apply of the catalog
expansion later canonicalised as repo `20260601120000` (which is also in the
ledger; the seed sync RPC is idempotent).

## Repo files absent from the ledger but verified live by object

| Repo file | Object evidence (checked 2026-07-05) |
|---|---|
| `20260605000000_european_brand_catalog` | 17 European-brand rows in `smoke_seed.brand_catalog` (Marlboro/Davidoff/Dunhill/Rothmans/Camel) |
| `20260606000000_realtime_publications` | superseded by `realtime_enable`/`realtime_brands`; `supabase_realtime` publishes `brand_variants, brands, cigarette_logs, goals, user_profiles` |

## How to re-verify

```sql
-- ledger
select version, name from supabase_migrations.schema_migrations order by version;
-- then spot-check objects: pg_proc for RPCs, pg_constraint for CHECKs,
-- pg_publication_tables for realtime, smoke_seed.* for catalogs/facts.
```
