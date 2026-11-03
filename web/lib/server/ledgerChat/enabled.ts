import { isChatPolicyLive } from '@/lib/legal';
import { cleanEnvValue } from '@web/lib/supabase/env';

/**
 * Off unless the operator sets it; the launcher hides and the route answers 503 while off.
 * In Production it also stays off until the privacy policy that describes the chat is live, so
 * flipping the flag early cannot start the feature. Preview and local runs are unaffected, which
 * is what lets the owner test before the bump. It fails closed: a production build whose
 * VERCEL_ENV is missing or unrecognised is gated too, so only a named Preview/Development
 * deployment, or a non-production NODE_ENV (next dev, CI, tests), skips the gate.
 */
export function isLedgerChatEnabled(privacy?: string): boolean {
  if (cleanEnvValue(process.env.LEDGER_CHAT_ENABLED) !== 'true') return false;
  const vercelEnv = cleanEnvValue(process.env.VERCEL_ENV);
  const isUngated = vercelEnv === 'preview' || vercelEnv === 'development' || process.env.NODE_ENV !== 'production';
  return isUngated || isChatPolicyLive(privacy);
}
