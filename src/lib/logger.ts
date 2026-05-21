import { getSupabase } from '@/lib/supabase';

export interface LogErrorContext {
  route?: string;
  category?: string;
  requestId?: string;
  digest?: string;
}

const MAX_MESSAGE = 500;

function safeMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, MAX_MESSAGE);
  }
  return String(error).slice(0, MAX_MESSAGE);
}

function safeDetails(ctx: LogErrorContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (ctx.route) out.route = String(ctx.route).slice(0, 120);
  if (ctx.requestId) out.request_id = String(ctx.requestId).slice(0, 64);
  if (ctx.digest) out.digest = String(ctx.digest).slice(0, 64);
  return out;
}

/**
 * Best-effort client error reporting into error_events (RLS: own user only).
 * Never throws; audit failures must not break UX.
 */
export async function logClientError(error: unknown, ctx: LogErrorContext = {}): Promise<void> {
  const message = safeMessage(error);
  const category = (ctx.category ?? 'client.error').slice(0, 80);

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('[logger]', category, message, ctx);
  }

  try {
    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('error_events').insert({
      user_id: user.id,
      category,
      message,
      route: ctx.route?.slice(0, 120) ?? null,
      request_id: ctx.requestId?.slice(0, 64) ?? null,
      details_json: safeDetails(ctx),
    });
  } catch {
    // Swallow — observability must not crash the app.
  }
}
