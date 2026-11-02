// One composite guard, fail closed. Web sends the cookie session and must be
// same-origin (CSRF); native sends a Supabase JWT as a Bearer token and no
// cookie. Either way the data client carries the caller's own JWT, so RLS
// scopes every read, and user_id is only ever the verified user.

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { isEmailConfirmed } from '@/lib/compliance';
import { requireSameOrigin } from '@web/lib/security/sameOrigin';
import { readSupabaseAnonKey, readSupabaseUrl } from '@web/lib/supabase/env';
import { createClient } from '@web/lib/supabase/server';

export interface ChatCaller {
  userId: string;
  db: SupabaseClient;
}

export type ChatCallerResult =
  | { ok: true; caller: ChatCaller }
  | { ok: false; status: 401 | 403 | 500; error: 'unauthorized' | 'forbidden' | 'server_misconfigured' };

const BEARER = /^Bearer\s+(\S+)$/i;

export async function resolveChatCaller(request: Request): Promise<ChatCallerResult> {
  const authorization = request.headers.get('authorization');
  const bearer = authorization ? BEARER.exec(authorization) : null;

  if (bearer) {
    const supabaseUrl = readSupabaseUrl();
    const supabaseAnonKey = readSupabaseAnonKey();
    if (!supabaseUrl || !supabaseAnonKey) return { ok: false, status: 500, error: 'server_misconfigured' };
    const db = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${bearer[1]}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db.auth.getUser(bearer[1]);
    if (error || !data.user || !isEmailConfirmed(data.user)) return { ok: false, status: 401, error: 'unauthorized' };
    return { ok: true, caller: { userId: data.user.id, db } };
  }

  if (!requireSameOrigin(request)) return { ok: false, status: 403, error: 'forbidden' };
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user || !isEmailConfirmed(data.user)) return { ok: false, status: 401, error: 'unauthorized' };
  return { ok: true, caller: { userId: data.user.id, db } };
}
