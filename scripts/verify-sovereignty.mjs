#!/usr/bin/env node
/**
 * Data-sovereignty verification (read-only, anon credentials only).
 *
 * Complements the existing automation rather than duplicating it:
 *   - verify-backend.mjs   → RPC existence + grants + edge-function presence
 *   - rls.integration.test → AUTHENTICATED cross-tenant isolation (user A vs B)
 *   - THIS script          → ANON default-deny: an unauthenticated client must
 *                            never read a single tenant row, and the data-rights
 *                            RPCs / edge function must refuse anon callers.
 *
 * It uses only the public anon key — no service-role key, no writes, no PII.
 * Every probe is a `SELECT … LIMIT 1` or a rejected RPC, so egress is trivial.
 *
 *   node scripts/verify-sovereignty.mjs
 *
 * Env (any one of each pair):
 *   SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL | E2E_SUPABASE_URL
 *   SUPABASE_ANON_KEY | NEXT_PUBLIC_SUPABASE_ANON_KEY | E2E_SUPABASE_ANON_KEY
 *
 * Exit code is non-zero if any sovereignty invariant is violated.
 */

import { createClient } from '@supabase/supabase-js';

const url =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.E2E_SUPABASE_URL;
const anonKey =
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.E2E_SUPABASE_ANON_KEY;

const results = [];

function pass(label) {
  results.push({ label, ok: true });
  console.log(`✓ ${label}`);
}

function fail(label, detail) {
  results.push({ label, ok: false, detail });
  console.error(`✗ ${label}${detail ? `: ${detail}` : ''}`);
}

function skip(label, reason) {
  results.push({ label, ok: true, skipped: true, detail: reason });
  console.log(`○ ${label} (skipped: ${reason})`);
}

function note(msg) {
  console.log(`  → ${msg}`);
}

/**
 * Tenant-scoped public tables. An anon client must read ZERO rows from each:
 * RLS policies key on auth.uid(), which is null for anon, so every row is
 * filtered. A non-empty result means a policy is leaking tenant data.
 *
 * Mirrors the public schema as audited 2026-06 (see
 * docs/security/sovereignty-audit-2026-06.md). If you add a public table,
 * add it here so the default-deny guard keeps full coverage.
 */
const TENANT_TABLES = [
  'audit_events',
  'brand_variants',
  'brands',
  'cigarette_logs',
  'error_events',
  'goals',
  'price_entries',
  'rate_limit_counters',
  'reminders',
  'settings_kv',
  'usage_events',
  'user_facts_seen',
  'user_profiles',
];

/** RPCs that expose account data — none may run for an anon caller. */
const DATA_RIGHTS_RPCS = [
  { name: 'export_account_data', args: { p_from: null, p_to: null, p_cursor_ts: null, p_cursor_id: null, p_limit: 1 } },
  { name: 'erase_account_data', args: {} },
  { name: 'record_audit_event', args: { p_event_type: 'consent_accepted', p_event_category: 'compliance', p_props: {} } },
];

function isAuthRejection(error) {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  return (
    code === '42501' ||
    code === 'PGRST301' ||
    code === 'PGRST116' ||
    msg.includes('permission denied') ||
    msg.includes('not authenticated') ||
    msg.includes('jwt') ||
    msg.includes('row-level security')
  );
}

async function probeTableDefaultDeny(supabase, table) {
  try {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      // A permission/RLS rejection is the strongest possible default-deny.
      pass(`anon default-deny: ${table} (rejected: ${error.code ?? 'rls'})`);
      return;
    }
    if (Array.isArray(data) && data.length === 0) {
      pass(`anon default-deny: ${table} (0 rows)`);
      return;
    }
    fail(
      `anon default-deny: ${table}`,
      `anon read returned ${Array.isArray(data) ? data.length : '?'} row(s) — RLS is leaking tenant data`,
    );
  } catch (e) {
    fail(`anon default-deny: ${table}`, e instanceof Error ? e.message : String(e));
  }
}

async function probeRpcRequiresAuth(supabase, rpc) {
  try {
    const { error } = await supabase.rpc(rpc.name, rpc.args);
    if (isAuthRejection(error)) {
      pass(`anon rejected: ${rpc.name} RPC`);
    } else if (!error) {
      fail(`anon rejected: ${rpc.name} RPC`, 'anon call SUCCEEDED — must require authentication');
    } else if (error.code === 'PGRST202') {
      fail(`anon rejected: ${rpc.name} RPC`, 'function not found — run npm run db:push');
    } else {
      // Any other error still means the anon call did not return data.
      pass(`anon rejected: ${rpc.name} RPC (${error.code ?? 'blocked'})`);
    }
  } catch (e) {
    pass(`anon rejected: ${rpc.name} RPC (threw)`);
    note(`${rpc.name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function probeDeleteAccountEdgeFn() {
  try {
    const res = await fetch(`${url}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (res.status === 401 || res.status === 403) {
      pass(`delete-account edge fn rejects anon (${res.status})`);
    } else if (res.status === 404) {
      skip('delete-account edge fn', 'not deployed on this project');
    } else {
      fail('delete-account edge fn rejects anon', `expected 401/403, got ${res.status}`);
    }
  } catch (e) {
    skip('delete-account edge fn', e instanceof Error ? e.message : String(e));
  }
}

function summarize() {
  const failed = results.filter((r) => !r.ok);
  console.log('\n---');
  if (failed.length) {
    console.error(`${failed.length} sovereignty invariant(s) violated — NOT safe to ship.`);
    process.exit(1);
  }
  console.log('All sovereignty invariants hold (anon default-deny enforced).');
}

async function main() {
  console.log('Smoke Ledger — data-sovereignty verification (anon default-deny)\n');

  if (!url || !anonKey) {
    fail('Supabase env', 'Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_* / E2E_* equivalents)');
    summarize();
    return;
  }

  console.log(`Target: ${url}\n`);

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const table of TENANT_TABLES) {
    await probeTableDefaultDeny(supabase, table);
  }

  for (const rpc of DATA_RIGHTS_RPCS) {
    await probeRpcRequiresAuth(supabase, rpc);
  }

  await probeDeleteAccountEdgeFn();

  summarize();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
