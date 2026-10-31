// Deletes the authenticated user via Admin API.
//
// Two-step deletion: this function ALWAYS calls `public.erase_account_data()`
// as the user before `auth.admin.deleteUser` runs. The SQL function explicitly
// purges every user-owned table and anonymizes audit rows; CASCADE then catches
// anything left over. The combination gives an auditable purge even if a
// future table is added without `ON DELETE CASCADE`.
//
// Hardening notes
// ----------------
// 1. JWT verification: the function uses `getUser(<bearer>)` on the anon client
//    to verify the access token. The deploy script no longer passes
//    `--no-verify-jwt`, so the Edge gateway also validates the token before it
//    reaches this code (defense in depth).
// 2. Recent re-auth gate: the caller must have signed in within the configured
//    window (default 15 minutes). This blocks "lost-laptop" abuse from a stale
//    refresh token escalating to account deletion.
// 3. Per-IP rate-limit via Deno KV: 5 attempts / 10 minutes / IP. Fails CLOSED
//    if KV is unavailable — a KV outage returns 429 rather than silently
//    disabling abuse protection (defense-in-depth). Logs the event for ops.
// 4. Origin allowlist: refuses unknown origins. Refuses `*` in production.
//    Shared with audit-record via ../_shared/cors.ts.
// 5. Audit trail: writes an `account_delete_requested` event with the user's
//    hashed id BEFORE the erase. The erase function itself writes a second
//    `account_data_erased` row with the same hash. A tamper-evident copy lives
//    in `error_events` (category compliance.delete) so the record survives the
//    auth-row cascade.
// 6. Erase fail-safe: if `erase_account_data()` fails the function aborts WITHOUT
//    calling admin.deleteUser. The user's data and auth row stay intact and the
//    user can retry. We never delete the auth row over an unverified purge.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { hashWithPepper } from '../_shared/hash.ts';
import { createLogger } from '../_shared/log.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { corsHeaders, originAllowed } from '../_shared/cors.ts';
import { hasRecentSignIn } from '../_shared/recentAuth.ts';

const log = createLogger('delete-account');

// ---------------- env ----------------

const REAUTH_WINDOW_MIN = Number.parseInt(Deno.env.get('REAUTH_WINDOW_MIN') ?? '15', 10);
const RATE_LIMIT_MAX = Number.parseInt(Deno.env.get('RATE_LIMIT_MAX') ?? '5', 10);
const RATE_LIMIT_WINDOW_SEC = Number.parseInt(Deno.env.get('RATE_LIMIT_WINDOW_SEC') ?? '600', 10);

// ---------------- helpers ----------------

function json(body: Record<string, unknown>, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

// ---------------- handler ----------------

serve(async (req) => {
  const origin = req.headers.get('origin');
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') {
    if (!originAllowed(origin)) {
      return json({ error: 'origin_not_allowed' }, 403, origin);
    }
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, origin);
  }

  if (!originAllowed(origin)) {
    return json({ error: 'origin_not_allowed' }, 403, origin);
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  // Without the pepper the IP and user-id hashes are reversible; fail closed like
  // erase_account_data does.
  const pepper = Deno.env.get('AUDIT_PEPPER');
  if (!url || !serviceKey || !anonKey || !pepper) {
    return json({ error: 'server_misconfigured', request_id: requestId }, 500, origin);
  }

  const ip = clientIp(req);
  const ipRate = await checkRateLimit({
    kind: 'delete-account',
    key: `ip:${await hashWithPepper(ip, pepper)}`,
    max: RATE_LIMIT_MAX,
    windowSec: RATE_LIMIT_WINDOW_SEC,
  });
  if (!ipRate.ok) {
    return json({ error: 'rate_limited', request_id: requestId }, 429, origin);
  }

  let userId: string | null = null;
  let userEmail: string | null = null;
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'missing_authorization', request_id: requestId }, 401, origin);
    }

    const supabaseUser = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userErr,
    } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return json({ error: 'unauthorized', request_id: requestId }, 401, origin);
    }
    userId = user.id;
    userEmail = user.email ?? null;

    // Per-user rate limit (in addition to per-IP) so a single user cannot drain
    // their own quota from many IPs.
    const userRate = await checkRateLimit({
      kind: 'delete-account',
      key: `user:${userId}`,
      max: RATE_LIMIT_MAX,
      windowSec: RATE_LIMIT_WINDOW_SEC,
    });
    if (!userRate.ok) {
      return json({ error: 'rate_limited', request_id: requestId }, 429, origin);
    }

    // Recent re-auth gate, bound to the presenting session's own `amr` claim.
    // The token was verified above (verify_jwt gateway + getUser), so its claims
    // can be read here. Token refreshes never count as a sign-in.
    if (!hasRecentSignIn(authHeader, Date.now(), REAUTH_WINDOW_MIN)) {
      return json(
        { error: 'reauth_required', request_id: requestId, window_min: REAUTH_WINDOW_MIN },
        401,
        origin,
      );
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Audit BEFORE delete. Audit row cascades along with the user, so also
    // write a tamper-evident copy into error_events (category compliance)
    // which we deliberately do not delete on user purge.
    const hashedUserId = await hashWithPepper(user.id, pepper);
    try {
      await supabaseAdmin.from('audit_events').insert({
        user_id: userId,
        event_type: 'account_delete_requested',
        event_category: 'compliance',
        props_json: { request_id: requestId, ip_hash: await hashWithPepper(ip, pepper) },
      });
      await supabaseAdmin.from('error_events').insert({
        user_id: null,
        category: 'compliance.delete',
        message: 'account_deleted',
        details_json: { request_id: requestId, hashed_user_id: hashedUserId },
      });
    } catch (auditErr) {
      // Audit is best-effort; do not abort the user-requested deletion.
      log.warn('audit_insert_failed', {
        request_id: requestId,
        error: auditErr instanceof Error ? String(auditErr.message).slice(0, 200) : 'unknown',
      });
    }

    // Step 1 of the 2-step deletion: explicit data purge.
    // erase_account_data() reads auth.uid() internally, so it must run with
    // the user's bearer token — supabaseUser is the same anon client we used
    // for getUser() above, with Authorization wired in. Service role would
    // bypass auth.uid() and the function would fail.
    const { error: eraseErr } = await supabaseUser.rpc('erase_account_data');
    if (eraseErr) {
      const pepperMissing = eraseErr.code === 'P0001';
      log.error('erase_failed_pre_delete', {
        request_id: requestId,
        error: String(eraseErr.message).slice(0, 200),
        code: eraseErr.code,
      });
      return json(
        { error: pepperMissing ? 'server_misconfigured' : 'erase_failed', request_id: requestId },
        pepperMissing ? 503 : 500,
        origin,
      );
    }

    // Step 2: remove the auth row. CASCADE catches any user-keyed rows the
    // erase missed (defense in depth against future schema drift).
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) {
      return json(
        {
          error: 'delete_failed',
          request_id: requestId,
        },
        400,
        origin,
      );
    }

    return json({ ok: true, request_id: requestId }, 200, origin);
  } catch (e) {
    log.error('internal_error', {
      request_id: requestId,
      name: e instanceof Error ? e.name : 'Unknown',
      message: e instanceof Error ? String(e.message).slice(0, 200) : 'unknown',
    });
    void userId;
    void userEmail;
    return json({ error: 'internal_error', request_id: requestId }, 500, origin);
  }
});
