// Records client-initiated audit events via service_role after JWT + allowlist validation.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  AUDIT_EVENT_CATEGORIES,
  AUDIT_EVENT_TYPES,
  redactAuditProps,
} from '../_shared/auditAllowlist.ts';
import { sha256Hex } from '../_shared/hash.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const ENV = (Deno.env.get('ENVIRONMENT') ?? Deno.env.get('ENV') ?? 'production').toLowerCase();
const IS_PROD = ENV === 'production';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const allowAnyOrigin = allowedOrigins.includes('*');

const RATE_LIMIT_MAX = Number.parseInt(Deno.env.get('AUDIT_RATE_LIMIT_MAX') ?? '10', 10);
const RATE_LIMIT_WINDOW_SEC = Number.parseInt(
  Deno.env.get('AUDIT_RATE_LIMIT_WINDOW_SEC') ?? '60',
  10,
);

function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  if (allowAnyOrigin && !IS_PROD) return true;
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

    const { ok: allowed } = await checkRateLimit({
      kind: 'audit-record',
      key: `user:${user.id}`,
      max: RATE_LIMIT_MAX,
      windowSec: RATE_LIMIT_WINDOW_SEC,
    });
    if (!allowed) {
      const userIdHash = await sha256Hex(`${user.id}:${Deno.env.get('AUDIT_PEPPER') ?? ''}`);
      console.warn(JSON.stringify({
        level: 'warn',
        event: 'audit_rate_limit_exceeded',
        user_id_hash: userIdHash,
        request_id: requestId,
      }));
      return json({ error: 'rate_limited', request_id: requestId }, 429, origin);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid_json', request_id: requestId }, 400, origin);
    }

    if (!body || typeof body !== 'object') {
      return json({ error: 'invalid_body', request_id: requestId }, 400, origin);
    }

    const record = body as Record<string, unknown>;
    const eventType = typeof record.event_type === 'string' ? record.event_type : '';
    const eventCategory =
      typeof record.event_category === 'string' ? record.event_category : 'account';
    const props =
      record.props && typeof record.props === 'object' && !Array.isArray(record.props)
        ? (record.props as Record<string, unknown>)
        : {};

    if (!AUDIT_EVENT_TYPES.has(eventType)) {
      return json({ error: 'invalid_event_type', request_id: requestId }, 400, origin);
    }
    if (!AUDIT_EVENT_CATEGORIES.has(eventCategory)) {
      return json({ error: 'invalid_event_category', request_id: requestId }, 400, origin);
    }

    const safeProps = redactAuditProps(props);

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: insertErr } = await supabaseAdmin.from('audit_events').insert({
      user_id: user.id,
      event_type: eventType.slice(0, 80),
      event_category: eventCategory.slice(0, 40),
      props_json: safeProps,
    });

    if (insertErr) {
      console.error('audit-record insert failed', requestId, insertErr.message);
      return json({ error: 'insert_failed', request_id: requestId }, 500, origin);
    }

    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  } catch (e) {
    console.error('audit-record internal error', {
      request_id: requestId,
      message: e instanceof Error ? String(e.message).slice(0, 200) : 'unknown',
    });
    return json({ error: 'internal_error', request_id: requestId }, 500, origin);
  }
});
