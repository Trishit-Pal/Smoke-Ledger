// Mobile only (askPill reads __DEV__, which the web typecheck does not know), so it
// lives apart from the service the web bundle also imports.

import { getSetting } from '@/db/repositories/settings';
import { isLedgerChatEnabled } from '@/lib/askPill';
import { LEDGER_CHAT_OPT_IN_KEY } from '@/services/ledgerChat';

/**
 * Whether sign-up and re-consent should put the Yes / No to this reader: the chat is on for
 * the build and no answer is stored at all. A stored false (declined) or any version string
 * (answered, current or stale) is an answer; a failed read means do not ask.
 */
export async function shouldAskChat(): Promise<boolean> {
  if (!isLedgerChatEnabled()) return false;
  try {
    return (await getSetting<unknown>(LEDGER_CHAT_OPT_IN_KEY)) === null;
  } catch {
    return false;
  }
}
