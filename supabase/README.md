# Supabase backend (Smoke Ledger)

## Migrations

Apply **in this order** (or use `npm run db:push` from the repo root after `supabase link`):

1. `migrations/20250426120000_initial_schema.sql` — tables, RLS policies, `handle_new_user` trigger, `seed_default_brands_if_empty()` RPC.
2. `migrations/20260504000000_enhancements.sql` — facts/milestones catalogs, RPCs, heatmap view, indexes.
3. `migrations/20260519100000_hardening_and_compliance.sql` — consent fields, audit/error tables, DB check constraints, `erase_account_data()`, `export_account_data()`, `record_audit_event()`.
4. `migrations/20260519130000_brand_catalog_expansion.sql` — expanded seed catalog + `sync_default_brand_catalog()` for existing users.
5. `migrations/20260520000000_security_correctness.sql` — atomic log RPC, export bounds, audit redaction helpers.
6. `migrations/20260521000000_audit_export_ops.sql` — export keyset pagination, revoke `record_audit_event` from clients, erase audit anonymization.

```bash
npm run db:push
npm run verify:backend
```

## Edge Functions

Both functions verify the caller JWT at the gateway and again in code. Deploy **after** migrations:

```bash
npm run functions:deploy:all
```

### `delete-account`

Deletes the authenticated user via Admin API (`service_role`). Requires recent re-auth (default 15 min).

### `audit-record`

Validates `event_type` / `event_category` allowlists, redacts props, rate-limits (60/min/user), inserts via `service_role`. Clients must **not** call `record_audit_event` RPC directly.

## Secrets (Dashboard → Edge Functions → Secrets)

Set on **both** functions:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service operations (auto when linked) |
| `SUPABASE_ANON_KEY` | JWT verification |
| `ALLOWED_ORIGINS` | Comma-separated web origins for CORS |
| `AUDIT_PEPPER` | Same value on both functions; hashes user id in retained audit/error rows |

Optional on `delete-account`: `REAUTH_WINDOW_MIN`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SEC`.

Optional on `audit-record`: `AUDIT_RATE_LIMIT_MAX`, `AUDIT_RATE_LIMIT_WINDOW_SEC`.

## Web audit path

Next.js web posts to `/api/audit`, which forwards to `audit-record` with the user's session token. Mobile invokes `audit-record` directly.

## Security notes

- Never put `service_role` in the Expo or Next.js client bundles.
- RLS is enabled on all `public` user tables; policies scope by `auth.uid()`.
- Do not use `user_metadata` for authorization in policies.
- Sensitive account actions use server-side operations (`erase_account_data`, `export_account_data`, Edge Functions).
- **Erase data** anonymizes audit rows (`user_id` null). **Delete account** removes auth identity.

See `docs/deployment/production-ops-checklist.md` for the full production checklist.
