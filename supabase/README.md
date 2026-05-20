# Supabase backend (Smoke Ledger)

## Migrations

Apply **in this order** (or use `npm run db:push` from the repo root after `supabase link`):

1. `migrations/20250426120000_initial_schema.sql` — tables, RLS policies, `handle_new_user` trigger, `seed_default_brands_if_empty()` RPC.
2. `migrations/20260504000000_enhancements.sql` — facts/milestones catalogs, RPCs, heatmap view, indexes.
3. `migrations/20260519100000_hardening_and_compliance.sql` — consent fields, audit/error tables, DB check constraints, `erase_account_data()`, `export_account_data()`, `record_audit_event()`.
4. `migrations/20260519130000_brand_catalog_expansion.sql` — expanded seed catalog + `sync_default_brand_catalog()` for existing users.

Use `supabase db push` or paste each file into the SQL editor in order.

## Edge Function: `delete-account`

Validates the caller’s JWT, then deletes the user with the Admin API (`service_role`).

Deploy:

```bash
npm run functions:deploy:delete-account
```

(`supabase functions deploy delete-account --no-verify-jwt` — adjust JWT verification in the dashboard if needed.)

Ensure the function environment includes `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` (auto when linked). After deploy, open **Edge Functions → delete-account → Secrets** in the dashboard and confirm all three (`SUPABASE_URL`, service role, anon) are set.

For browser invocation, set `ALLOWED_ORIGINS` (comma-separated) to your production and preview web origins. If omitted, cross-origin browser requests are rejected by default.

## Security notes

- Never put `service_role` in the Expo app.
- RLS is enabled on all `public` user tables; policies scope by `auth.uid()`.
- Do not use `user_metadata` for authorization in policies.
- Sensitive account actions should use server-side operations (`erase_account_data`, `export_account_data`, Edge function delete-account).
