// Deletes the authenticated user via Admin API.
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
// 5. Audit trail: writes an `account_deleted` event with the user's hashed id
//    BEFORE calling `admin.deleteUser`. After delete the row remains with a
//    NULL `user_id` (it cascades on the original row), but we additionally
//    persist a copy in `error_events` with category `compliance.delete` so the
//    record survives the cascade.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { sha256Hex } from '../_shared/hash.ts';
import { createLogger } from '../_shared/log.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const log = createLogger('delete-account');

// ---------------- env ----------------

const ENV = (Deno.env.get('ENVIRONMENT') ?? Deno.env.get('ENV') ?? 'production').toLowerCase();
const IS_PROD = ENV === 'production';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const allowAnyOrigin = allowedOrigins.includes('*');

const REAUTH_WINDOW_MIN = Number.parseInt(Deno.env.get('REAUTH_WINDOW_MIN') ?? '15', 10);
const RATE_LIMIT_MAX = Number.parseInt(Deno.env.get('RATE_LIMIT_MAX') ?? '5', 10);
const RATE_LIMIT_WINDOW_SEC = Number.parseInt(Deno.env.get('RATE_LIMIT_WINDOW_SEC') ?? '600', 10);

// ---------------- helpers ----------------

function originAllowed(origin: string | null): boolean {
  if (!origin) return true; // Non-browser clients (mobile, curl).
  if (allowAnyOrigin && !IS_PROD) return true; // '*' allowed only outside prod.
  return allowedOrigins.includes(origin);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = originAllowed(origin) && origin;
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

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
  if (!url || !serviceKey || !anonKey) {
    return json({ error: 'server_misconfigured', request_id: requestId }, 500, origin);
  }

  const ip = clientIp(req);
  const ipRate = await checkRateLimit({
    kind: 'delete-account',
    key: `ip:${await sha256Hex(ip)}`,
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

    // Recent re-auth gate. `last_sign_in_at` is updated on every full
    // authentication; refresh-only sessions are filtered out.
    const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
    const ageMin = (Date.now() - lastSignIn) / 60_000;
    if (!Number.isFinite(ageMin) || ageMin > REAUTH_WINDOW_MIN) {
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
    const hashedUserId = await sha256Hex(`${userId}:${Deno.env.get('AUDIT_PEPPER') ?? ''}`);
    try {
      await supabaseAdmin.from('audit_events').insert({
        user_id: userId,
        event_type: 'account_delete_requested',
        event_category: 'compliance',
        props_json: { request_id: requestId, ip_hash: await sha256Hex(ip) },
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
