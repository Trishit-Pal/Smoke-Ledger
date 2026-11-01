import { cleanEnvValue } from '@web/lib/supabase/env';

/** Off unless the operator sets it; the launcher hides and the route answers 503 while off. */
export function isLedgerChatEnabled(): boolean {
  return cleanEnvValue(process.env.LEDGER_CHAT_ENABLED) === 'true';
}
