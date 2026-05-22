# Runbook: rotating `AUDIT_PEPPER`

## What `AUDIT_PEPPER` is

A server-only secret used by Edge Functions (`delete-account/index.ts`, `audit-record/index.ts`) to hash user IDs before they are written to long-lived audit rows. Specifically:

```ts
hashedUserId = sha256Hex(`${user.id}:${AUDIT_PEPPER}`)
```

The hashed ID is stored in `error_events.details_json` (compliance.delete category, `user_id IS NULL`) and in the rate-limit warning logs. The raw user UUID is never written to these locations.

The pepper is what makes the audit record survive [DPDP-style](https://www.meity.gov.in/) deletion while remaining non-reversible: once the user account is purged from `auth.users`, the hashed ID in the audit row has no public counterpart to correlate against.

## Why rotate

Rotation is required when:

1. **The pepper value is suspected to have leaked** — a maintainer accidentally pasted it into a log line, ticket, screenshot, or repo. **This is the primary trigger.**
2. **A maintainer with `AUDIT_PEPPER` access leaves the team** — same threat model as service-role key rotation.
3. **Scheduled defense-in-depth** — once every 6–12 months even without an incident. Audit pepper has the same lifetime characteristics as a long-lived signing key.

Rotation is **not** required when:

- Adding or removing maintainers who do not have edge-function secret access.
- Re-deploying the Edge Functions (the secret is read from `Deno.env` at every invocation).

## What rotation breaks (read before you rotate)

After rotation, **the same user.id will hash to a different value**. Concretely:

| Capability | Before rotation | After rotation |
|---|---|---|
| Correlate two compliance.delete rows for the same user across the rotation boundary | Possible | Impossible |
| Investigate a single user's pre-rotation rate-limit pattern | Possible (with the user's UUID) | Possible only if a maintainer kept the user.id ↔ pre-rotation hash mapping somewhere — and that mapping itself becomes a re-identification artefact |
| Investigate a single user's post-rotation rate-limit pattern | n/a | Possible with their current UUID + new pepper |

Rotation is therefore a **trade-off**: stronger anonymization vs. weaker forensic continuity. For a DPDP-best-effort posture (per `project_launch_posture.md`), this is the correct trade — the audit row's purpose is "we can prove a deletion happened", not "we can reconstruct deleted users."

## Procedure

**Pre-rotation checklist:**

- [ ] You have access to the Supabase dashboard for the production project.
- [ ] You have access to GitHub Actions secrets (only if `AUDIT_PEPPER` is mirrored there for CI — it should not be; CI uses a separate Supabase project that does not need this pepper).
- [ ] You have decided whether to record the timestamp of rotation in a separate, locked location (e.g., a private team note). Recording the boundary in plain prose is fine; do **not** record the old pepper value.
- [ ] No incident response is in flight that requires correlating pre/post rotation audit rows.

**Steps:**

1. Generate a new pepper value. Recommended: 32 random bytes hex-encoded.
   ```bash
   openssl rand -hex 32
   ```
   Or in Node:
   ```js
   require('crypto').randomBytes(32).toString('hex')
   ```

2. Update the secret in the Supabase Edge Function configuration:
   - Supabase Dashboard → Project → Edge Functions → Secrets
   - Find `AUDIT_PEPPER` (set per the production-ops-checklist)
   - Replace its value with the new pepper
   - Save

3. Verify the change took effect. Either:
   - Trigger a fresh request that exercises `audit-record` (any client event with consent enabled) and confirm the function returns success.
   - Or call the rate-limited path 11 times in 60 s as a single user to trigger one `audit_rate_limit_exceeded` log line; check the Supabase function logs and confirm the `user_id_hash` field is present and is **different** from any hash you have in pre-rotation logs.

4. Note the rotation in your private team log. Suggested format:
   ```
   AUDIT_PEPPER rotated YYYY-MM-DD HH:MM IST. Reason: <one line>.
   No pre-rotation hashes retained.
   ```

5. **Do not** revoke or rotate the old pepper anywhere else — the only consumer is the Edge Function env. Once the new value is in place and verified, the old value should be discarded (overwrite the buffer, close the terminal, etc.).

**Post-rotation:**

- Existing rows in `error_events` (category `compliance.delete`) still contain hashes derived from the previous pepper. They remain forensically inert by design — the user.id that produced them either no longer exists or has a new (non-correlatable) hash post-rotation.
- The `audit_events` table is not affected by the pepper directly — those rows use the raw `user_id` foreign key. The pepper only protects the post-deletion audit copy in `error_events`.

## Failure modes

- **Forgot to update the secret in Supabase Dashboard, only updated locally**: Edge Functions on production still use the old pepper. Detection: deploy logs show no `AUDIT_PEPPER` change. Fix: repeat step 2.
- **Updated the dashboard but the function caches stale env**: Deno KV / module-level reads of `Deno.env.get('AUDIT_PEPPER')` happen on every invocation; there is no cache. If you suspect staleness, re-deploy the function: `npm run functions:deploy:audit-record`.
- **Accidentally recorded the new pepper in a log or commit**: revert the commit, scrub the log, repeat the entire procedure with a fresh pepper.

## Related files

- `supabase/functions/delete-account/index.ts` (uses pepper for `hashed_user_id`)
- `supabase/functions/audit-record/index.ts` (uses pepper for rate-limit-warning `user_id_hash`)
- `docs/deployment/production-ops-checklist.md` (lists `AUDIT_PEPPER` as a required Edge Function secret)
- `supabase/migrations/20260520000000_security_correctness.sql` (`app.audit_pepper` GUC, if pepper is ever also surfaced via a DB function — currently it is not)
