import type { AppErrorCode } from '@/lib/errors';

export type EdgeErrorBody = { error?: string; window_min?: number } | null;

/**
 * Maps an Edge Function response body to an AppErrorCode and the raw server
 * code. Pure function — no Supabase, no side effects, safe to import in tests.
 */
export function parseEdgeFunctionError(body: EdgeErrorBody): {
  code: AppErrorCode;
  serverCode: string | null;
} {
  const serverCode =
    body !== null && typeof body === 'object' && typeof body.error === 'string'
      ? body.error
      : null;

  if (serverCode === 'reauth_required') return { code: 'authentication_error', serverCode };
  if (serverCode === 'rate_limited') return { code: 'rate_limited', serverCode };
  return { code: 'dependency_failure', serverCode };
}

/**
 * Reads and parses the response body from a supabase-js FunctionsHttpError.
 * In supabase-js v2, non-2xx Edge Function responses set data=null and put
 * the body in error.context (a native Response object).
 *
 * Includes a 3-second timeout guard so HTML bodies (Cloudflare 524, etc.)
 * don't cause the caller to hang indefinitely.
 */
export async function parseEdgeResponse(error: unknown): Promise<EdgeErrorBody> {
  try {
    const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (!ctx || typeof ctx.json !== 'function') return null;
    const parsed = await Promise.race<unknown>([
      ctx.json(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      ),
    ]);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as EdgeErrorBody;
    }
    return null;
  } catch {
    return null;
  }
}
