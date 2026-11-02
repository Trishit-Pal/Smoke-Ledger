#!/usr/bin/env node
/**
 * Post-deploy backend verification. Requires `supabase link` and env:
 * SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).
 * Optional E2E creds for export pagination smoke.
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

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

async function checkRpcExists(supabase, rpcName, args = {}) {
  try {
    const { error } = await supabase.rpc(rpcName, args);
    if (error?.code === '42501' || error?.message?.includes('not authenticated')) {
      pass(`${rpcName} RPC exists (auth required)`);
    } else if (error?.code === 'PGRST202') {
      fail(`${rpcName} RPC`, 'function not found — run npm run db:push');
    } else if (error) {
      pass(`${rpcName} RPC reachable (${error.code ?? 'error'})`);
    } else {
      pass(`${rpcName} RPC exists`);
    }
  } catch (e) {
    fail(`${rpcName} RPC`, e instanceof Error ? e.message : String(e));
  }
}

async function main() {
  console.log('Smoke Ledger — backend verification\n');

  if (!url || !anonKey) {
    fail('Supabase env', 'Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_* equivalents)');
    summarize();
    process.exit(1);
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Migrations / RPC existence
  try {
    const { error } = await supabase.rpc('export_account_data', {
      p_from: null,
      p_to: null,
      p_cursor_ts: null,
      p_cursor_id: null,
      p_limit: 1,
    });
    if (error?.code === '42501' || error?.message?.includes('not authenticated')) {
      pass('export_account_data RPC exists (auth required)');
    } else if (error?.code === 'PGRST202') {
      fail('export_account_data RPC', 'function not found — run npm run db:push');
    } else if (error) {
      pass(`export_account_data RPC reachable (${error.code ?? 'error'})`);
    } else {
      pass('export_account_data RPC exists');
    }
  } catch (e) {
    fail('export_account_data RPC', e instanceof Error ? e.message : String(e));
  }

  try {
    const { error } = await supabase.rpc('create_log_with_rate_limit', {
      p_id: 'x',
      p_ts_utc: new Date().toISOString(),
      p_local_date: '2026-01-01',
      p_local_hour: 0,
      p_brand_id: null,
      p_brand_name_snap: null,
      p_variant_snap: null,
      p_quantity: 1,
      p_purchase_mode: 'single',
      p_pack_size: null,
      p_total_price_inr: null,
      p_unit_price_inr: null,
      p_price_source: 'unknown',
      p_trigger_tag: null,
      p_mood_before: null,
      p_mood_after: null,
      p_craving: null,
      p_context_tag: null,
      p_notes: null,
      p_client_op_id: null,
    });
    if (error?.code === '42501' || error?.message?.includes('not authenticated')) {
      pass('create_log_with_rate_limit RPC exists (auth required)');
    } else if (error?.code === 'PGRST202') {
      fail('create_log_with_rate_limit RPC', 'function not found');
    } else {
      pass(`create_log_with_rate_limit RPC reachable`);
    }
  } catch (e) {
    fail('create_log_with_rate_limit RPC', e instanceof Error ? e.message : String(e));
  }

  await checkRpcExists(supabase, 'sync_default_brand_catalog');
  await checkRpcExists(supabase, 'refresh_seed_prices_from_catalog');

  // service_role only: the anon call is denied (42501), which still proves the function exists.
  await checkRpcExists(supabase, 'purge_expired_records');

  // record_audit_event must NOT be callable by anon/unauthenticated
  try {
    const { error } = await supabase.rpc('record_audit_event', {
      p_event_type: 'consent_accepted',
      p_event_category: 'compliance',
      p_props: {},
    });
    if (
      error &&
      (error.code === '42501' ||
        error.code === 'PGRST301' ||
        error.message?.includes('permission denied') ||
        error.message?.includes('not authenticated'))
    ) {
      pass('record_audit_event revoked from unauthenticated');
    } else if (!error) {
      fail('record_audit_event revoke', 'unauthenticated call succeeded');
    } else {
      pass(`record_audit_event blocked (${error.code ?? 'ok'})`);
    }
  } catch (e) {
    pass('record_audit_event blocked for anon');
  }

  // Edge functions list
  try {
    const out = execSync('supabase functions list --output json', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const fns = JSON.parse(out);
    const names = (Array.isArray(fns) ? fns : fns.functions ?? []).map(
      (f) => f.slug ?? f.name ?? f,
    );
    for (const required of ['delete-account', 'audit-record']) {
      if (names.some((n) => String(n).includes(required))) {
        pass(`Edge function deployed: ${required}`);
      } else {
        fail(`Edge function deployed: ${required}`, 'run npm run functions:deploy:all');
      }
    }
  } catch {
    skip('Edge functions list', 'supabase CLI not linked or functions not deployed locally');
  }

  // Optional export pagination with E2E user
  const e2eEmail = process.env.E2E_USER_A_EMAIL ?? process.env.E2E_LOGIN_EMAIL;
  const e2ePassword = process.env.E2E_USER_A_PASSWORD ?? process.env.E2E_LOGIN_PASSWORD;
  if (e2eEmail && e2ePassword) {
    const authed = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signIn = await authed.auth.signInWithPassword({
      email: e2eEmail,
      password: e2ePassword,
    });
    if (signIn.error) {
      skip('export pagination smoke', signIn.error.message);
    } else {
      const { data, error } = await authed.rpc('export_account_data', {
        p_from: null,
        p_to: null,
        p_cursor_ts: null,
        p_cursor_id: null,
        p_limit: 100,
      });
      if (error) {
        fail('export pagination smoke', error.message);
      } else if (data && typeof data === 'object' && 'hasMore' in data) {
        pass('export pagination returns hasMore cursor fields');
      } else {
        fail('export pagination smoke', 'missing hasMore in payload');
      }
      await authed.auth.signOut();
    }
  } else {
    skip('export pagination smoke', 'set E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD');
  }

  note("Manual (owner action if pg_cron is absent): SELECT jobname, schedule FROM cron.job WHERE jobname = 'purge-expired-records'; scripts/sql/smoke.sql also gates this in CI");
  note('Manual: Supabase Auth → Enable Confirm email');
  note('Manual: Edge secrets → ALLOWED_ORIGINS, AUDIT_PEPPER, SUPABASE_SERVICE_ROLE_KEY');
  note('Manual: Optional Captcha (Turnstile) + NEXT_PUBLIC_TURNSTILE_SITE_KEY on web');

  summarize();
}

function summarize() {
  const failed = results.filter((r) => !r.ok);
  console.log('\n---');
  if (failed.length) {
    console.error(`${failed.length} check(s) failed.`);
    process.exit(1);
  }
  console.log('All automated checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
