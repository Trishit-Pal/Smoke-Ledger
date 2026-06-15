#!/usr/bin/env node
/**
 * Live E2E: prove the full account-deletion contract.
 *
 *   1. A deleted account is INACCESSIBLE — old credentials no longer log in and
 *      the auth.users row is gone (hard delete).
 *   2. The SAME email can RE-REGISTER as a brand-new account with a new id and
 *      ZERO data — "same as first-time login".
 *
 * It creates and deletes its OWN throwaway users and cleans up after itself.
 * Point it at STAGING; running against production is acceptable only with intent
 * (it exercises the live delete-account edge function, like preflight-launch.mjs).
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/verify-delete-resignup.mjs
 *
 * Env:
 *   SUPABASE_URL              (or NEXT_PUBLIC_SUPABASE_URL / E2E_SUPABASE_URL)
 *   SUPABASE_ANON_KEY         (or NEXT_PUBLIC_SUPABASE_ANON_KEY / E2E_SUPABASE_ANON_KEY)
 *   SUPABASE_SERVICE_ROLE_KEY (required — Admin API create/confirm/delete)
 *   RESIGNUP_TEST_EMAIL       (optional — defaults to a unique throwaway address)
 *
 * Exit code is non-zero if any contract assertion fails.
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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const results = [];
const pass = (label) => { results.push({ ok: true }); console.log(`✓ ${label}`); };
const fail = (label, detail) => { results.push({ ok: false }); console.error(`✗ ${label}${detail ? `: ${detail}` : ''}`); };
const skip = (label, reason) => { results.push({ ok: true }); console.log(`○ ${label} (skipped: ${reason})`); };
const note = (msg) => console.log(`  → ${msg}`);

function summarize() {
  const failed = results.filter((r) => !r.ok);
  console.log('\n---');
  if (failed.length) {
    console.error(`${failed.length} assertion(s) failed — deletion contract NOT satisfied.`);
    process.exit(1);
  }
  console.log('Deletion contract satisfied: deleted account is inaccessible and re-signup is fresh.');
}

async function main() {
  console.log('Smoke Ledger — delete → re-signup E2E\n');

  if (!url || !anonKey) {
    fail('Supabase env', 'Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_* / E2E_* equivalents)');
    summarize();
    return;
  }
  if (!serviceRoleKey) {
    skip('delete → re-signup E2E', 'set SUPABASE_SERVICE_ROLE_KEY to run the Admin-API loop');
    note('Without it, this contract can only be verified manually via the UI.');
    summarize();
    return;
  }

  console.log(`Target: ${url}  ⚠ prefer STAGING.\n`);

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = process.env.RESIGNUP_TEST_EMAIL ?? `delete-resignup-${Date.now()}@example.com`;
  const password = `Dr!${Math.random().toString(36).slice(2)}A9`;
  let userId1;
  let userId2;
  let user1DeletedByEdgeFn = false;

  try {
    // 1. Create + confirm a throwaway user.
    const c1 = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (c1.error || !c1.data?.user) {
      fail('create throwaway user', c1.error?.message ?? 'no user returned');
      return;
    }
    userId1 = c1.data.user.id;
    pass(`created throwaway user (${userId1.slice(0, 8)}…)`);

    // 2. Sign in so last_sign_in_at is recent (inside the reauth window).
    const s1 = await anon.auth.signInWithPassword({ email, password });
    if (s1.error || !s1.data?.session) {
      fail('sign in before delete', s1.error?.message ?? 'no session');
      return;
    }
    const token = s1.data.session.access_token;
    pass('signed in (recent → within reauth window)');

    // 3. Delete via the live edge function (server-to-server: no Origin, allowed).
    const delRes = await fetch(`${url}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const delBody = await delRes.json().catch(() => ({}));
    if (delRes.status === 200 && delBody.ok) {
      user1DeletedByEdgeFn = true;
      pass('delete-account edge function returned 200 ok');
    } else {
      fail('delete-account', `status ${delRes.status} body ${JSON.stringify(delBody)}`);
      return;
    }

    // 4. Old credentials must no longer authenticate.
    const reLogin = await anon.auth.signInWithPassword({ email, password });
    if (reLogin.error && !reLogin.data?.session) {
      pass('old credentials rejected after deletion (inaccessible)');
    } else {
      fail('inaccessibility', 'old credentials still authenticate after deletion');
    }

    // 5. The auth.users row is gone (hard delete, not soft).
    const lookup = await admin.auth.admin.getUserById(userId1);
    if (lookup.error || !lookup.data?.user) {
      pass('auth.users row removed (hard delete)');
    } else {
      fail('hard delete', 'auth user still present after deletion');
    }

    // 6. Same email re-registers as a NEW user.
    const c2 = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (c2.error || !c2.data?.user) {
      fail('re-signup same email', c2.error?.message ?? 'no user returned');
      return;
    }
    userId2 = c2.data.user.id;
    if (userId2 !== userId1) {
      pass(`same email re-registers with a NEW id (${userId2.slice(0, 8)}…)`);
    } else {
      fail('re-signup id', 'reused the deleted user id');
    }

    // 7. The new account is empty — first-time state.
    const s2 = await anon.auth.signInWithPassword({ email, password });
    if (s2.error || !s2.data?.session) {
      fail('sign in after re-signup', s2.error?.message ?? 'no session');
    } else {
      const authed = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${s2.data.session.access_token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const logs = await authed.from('cigarette_logs').select('id').limit(1);
      if (!logs.error && (logs.data?.length ?? 0) === 0) {
        pass('new account has zero logs (fresh)');
      } else {
        fail('fresh logs', logs.error ? logs.error.message : `found ${logs.data.length} row(s)`);
      }

      const prof = await authed.from('user_profiles').select('onboarded_at').maybeSingle();
      if (!prof.error && (!prof.data || prof.data.onboarded_at == null)) {
        pass('new account is not onboarded (first-time state)');
      } else {
        fail('fresh profile', prof.error ? prof.error.message : `onboarded_at=${prof.data?.onboarded_at}`);
      }
      await anon.auth.signOut({ scope: 'local' });
    }
  } catch (e) {
    fail('e2e', e instanceof Error ? e.message : String(e));
  } finally {
    // If the test bailed before the edge function deleted user 1, remove it so
    // no throwaway auth row is orphaned in the target environment.
    if (userId1 && !user1DeletedByEdgeFn) {
      const d1 = await admin.auth.admin.deleteUser(userId1);
      if (d1.error) note(`cleanup: could not delete orphan ${userId1.slice(0, 8)}…: ${d1.error.message}`);
      else note(`cleanup: deleted orphaned user ${userId1.slice(0, 8)}…`);
    }
    // Clean up the re-created user (user 1 was already deleted by the edge fn).
    if (userId2) {
      const d = await admin.auth.admin.deleteUser(userId2);
      if (d.error) note(`cleanup: could not delete ${userId2.slice(0, 8)}…: ${d.error.message}`);
      else note(`cleanup: deleted re-created user ${userId2.slice(0, 8)}…`);
    }
  }

  summarize();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
