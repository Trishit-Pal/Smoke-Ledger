import { isChatPolicyLive } from '@/lib/legal';
import { cleanEnvValue } from '@web/lib/supabase/env';

/**
 * Off unless the operator sets it; the launcher hides and the route answers 503 while off.
 * In Production it also stays off until the privacy policy that describes the chat is live, so
 * flipping the flag early cannot start the feature. Preview, dev and CI (VERCEL_ENV not
 * "production") are unaffected, which is what lets the owner test before the bump.
 */
export function isLedgerChatEnabled(privacy?: string): boolean {
  if (cleanEnvValue(process.env.LEDGER_CHAT_ENABLED) !== 'true') return false;
  return cleanEnvValue(process.env.VERCEL_ENV) !== 'production' || isChatPolicyLive(privacy);
}
