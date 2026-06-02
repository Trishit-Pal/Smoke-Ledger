#!/usr/bin/env node
/**
 * Launch preflight for Smoke Ledger (web-first).
 *
 * Verifies the launch BLOCKERS that live in dashboards (not the repo) and runs
 * the real auth loop end-to-end. Point it at STAGING, not production — it
 * creates and then deletes a throwaway user.
 *
 *   node scripts/preflight-launch.mjs
 *
 * Env (read from the shell / your CI secret store):
 *   SUPABASE_URL                 (or NEXT_PUBLIC_SUPABASE_URL / E2E_SUPABASE_URL)
 *   SUPABASE_ANON_KEY            (or NEXT_PUBLIC_SUPABASE_ANON_KEY / E2E_SUPABASE_ANON_KEY)
 *   SUPABASE_SERVICE_ROLE_KEY    (optional) — enables the confirm→login→cleanup loop
 *   SUPABASE_ACCESS_TOKEN        (optional) — personal access token for the
 *   SUPABASE_PROJECT_REF         (optional)   Management API auth-config audit
 *   PREFLIGHT_TEST_EMAIL         (optional) — a real inbox you can check for the
 *                                             "did the email actually arrive?" step
 *
 * Exit code is non-zero if any BLOCKER check fails.
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
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef =
  process.env.SUPABASE_PROJECT_REF ??
  (url ? url.replace(/^https?:\/\//, '').split('.')[0] : undefined);

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

/** Look up the first present key from a list of candidate names. */
function pick(obj, candidates) {
  for (const name of candidates) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, name) && obj[name] != null) {
      return { key: name, value: obj[name] };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. Dashboard config audit via the Management API (the 5 launch blockers).
// ---------------------------------------------------------------------------
async function auditAuthConfig() {
  if (!accessToken || !projectRef) {
    skip(
      'Auth config audit',
      'set SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF to verify SMTP / captcha / site URL / leaked-password automatically',
    );
    note('Without it, confirm these manually in Supabase Dashboard → Authentication.');
    return;
  }

  let config;
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      fail('Auth config audit', `Management API returned ${res.status} ${res.statusText}`);
      return;
    }
    config = await res.json();
  } catch (e) {
    fail('Auth config audit', e instanceof Error ? e.message : String(e));
    return;
  }

  // 🔴 Custom SMTP — presence of an SMTP host/user means the built-in (throttled)
  // mailer is NOT in use. This is the top launch blocker.
  const smtpHost = pick(config, ['smtp_host', 'smtp_admin_email', 'smtp_user', 'smtp_sender_name']);
  if (smtpHost) {
    pass(`Custom SMTP configured (${smtpHost.key}=${String(smtpHost.value).slice(0, 40)})`);
  } else {
    fail(
      'Custom SMTP configured',
      'no SMTP host found — built-in mailer silently throttles signup/reset email (see docs/deployment/auth-email-delivery.md)',
    );
  }

  // Email confirmation must be ON (autoconfirm OFF).
  const autoconfirm = pick(config, ['mailer_autoconfirm']);
  if (autoconfirm && autoconfirm.value === true) {
    fail('Email confirmation enabled', 'mailer_autoconfirm=true means confirmation is OFF');
  } else if (autoconfirm) {
    pass('Email confirmation enabled (mailer_autoconfirm=false)');
  } else {
    skip('Email confirmation enabled', 'mailer_autoconfirm not present in config response');
  }

  // 🟡 Site URL set to a production origin.
  const siteUrl = pick(config, ['site_url']);
  if (siteUrl && !/localhost|127\.0\.0\.1/.test(String(siteUrl.value))) {
    pass(`Auth Site URL set (${siteUrl.value})`);
  } else if (siteUrl) {
    fail('Auth Site URL set', `still points at localhost (${siteUrl.value})`);
  } else {
    skip('Auth Site URL set', 'site_url not present in config response');
  }

  // 🟡 Redirect allowlist includes the callback path.
  const allowList = pick(config, ['uri_allow_list']);
  if (allowList && /\/auth\/callback/.test(String(allowList.value))) {
    pass('Redirect allowlist includes /auth/callback');
  } else if (allowList) {
    fail('Redirect allowlist includes /auth/callback', `got: ${allowList.value}`);
  } else {
    skip('Redirect allowlist', 'uri_allow_list not present in config response');
  }

  // 🟠 Captcha (Turnstile) enabled.
  const captcha = pick(config, ['security_captcha_enabled', 'captcha_enabled']);
  if (captcha && captcha.value === true) {
    const provider = pick(config, ['security_captcha_provider', 'captcha_provider']);
    pass(`Captcha enabled${provider ? ` (provider=${provider.value})` : ''}`);
  } else if (captcha) {
    fail('Captcha enabled', 'Turnstile is wired in the app but disabled in Supabase Auth');
  } else {
    skip('Captcha enabled', 'captcha flag not present in config response');
  }

  // 🟡 Leaked-password protection (HaveIBeenPwned).
  const hibp = pick(config, ['password_hibp_enabled', 'security_hibp_enabled']);
  if (hibp && hibp.value === true) {
    pass('Leaked-password protection enabled');
  } else if (hibp) {
    fail('Leaked-password protection enabled', 'HaveIBeenPwned check is off');
  } else {
    skip('Leaked-password protection', 'hibp flag not present in config response — verify manually');
  }
}

// ---------------------------------------------------------------------------
// 2. Real auth loop: signup → (admin confirm) → login → reset → cleanup.
// ---------------------------------------------------------------------------
async function authLoop() {
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = serviceRoleKey
    ? createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  const email = process.env.PREFLIGHT_TEST_EMAIL ?? `preflight-${Date.now()}@example.com`;
  const password = `Pf!${Math.random().toString(36).slice(2)}A9`;
  let userId;

  try {
    const { data, error } = await anon.auth.signUp({ email, password });
    if (error) {
      fail('Signup loop — auth.signUp', error.message);
      return;
    }
    userId = data?.user?.id;
    pass(`Signup loop — auth.signUp accepted (${email})`);
    if (data?.user && (data.user.identities ?? []).length === 0) {
      note('Signup returned an existing-user shape — pick a fresh PREFLIGHT_TEST_EMAIL.');
    }

    if (!admin) {
      skip('Signup loop — confirm + login', 'set SUPABASE_SERVICE_ROLE_KEY to run the full loop');
    } else if (userId) {
      const confirm = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
      if (confirm.error) {
        fail('Signup loop — admin confirm', confirm.error.message);
      } else {
        pass('Signup loop — admin confirm');
        const signIn = await anon.auth.signInWithPassword({ email, password });
        if (signIn.error) {
          fail('Signup loop — login after confirm', signIn.error.message);
        } else if (signIn.data?.session) {
          pass('Signup loop — login after confirm returns a session');
          await anon.auth.signOut();
        } else {
          fail('Signup loop — login after confirm', 'no session returned');
        }
      }
    }

    const reset = await anon.auth.resetPasswordForEmail(email);
    if (reset.error) {
      fail('Reset loop — resetPasswordForEmail', reset.error.message);
    } else {
      pass('Reset loop — resetPasswordForEmail accepted');
      note('Email DELIVERY itself is not asserted here — check a real inbox via PREFLIGHT_TEST_EMAIL.');
    }
  } finally {
    if (admin && userId) {
      const del = await admin.auth.admin.deleteUser(userId);
      if (del.error) note(`Cleanup: could not delete test user ${userId}: ${del.error.message}`);
      else note(`Cleanup: deleted test user ${userId}.`);
    }
  }
}

function summarize() {
  const failed = results.filter((r) => !r.ok);
  console.log('\n---');
  if (failed.length) {
    console.error(`${failed.length} blocker check(s) failed — NOT ready for production.`);
    process.exit(1);
  }
  console.log('All preflight checks passed.');
}

async function main() {
  console.log('Smoke Ledger — launch preflight\n');
  if (!url || !anonKey) {
    fail('Supabase env', 'Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_* equivalents)');
    summarize();
    return;
  }
  console.log(`Target: ${url}  ⚠ run this against STAGING, not production.\n`);

  await auditAuthConfig();
  await authLoop();
  summarize();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
