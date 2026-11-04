// Mobile only (askPill reads __DEV__, which the web typecheck does not know), so it
// lives apart from the service the web bundle also imports.

import { getSetting } from '@/db/repositories/settings';
import { isLedgerChatEnabled } from '@/lib/askPill';
import { LEDGER_CHAT_OPT_IN_KEY } from '@/services/ledgerChat';

/** A half-open connection must not hold Continue / Accept: after this, do not ask. */
const READ_TIMEOUT_MS = 4000;

/**
 * Whether sign-up and re-consent should put the Yes / No to this reader: the chat is on for
 * the build and no answer is stored at all. A stored false (declined) or any version string
 * (answered, current or stale) is an answer; a failed or stalled read means do not ask.
 */
export async function shouldAskChat(): Promise<boolean> {
  if (!isLedgerChatEnabled()) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), READ_TIMEOUT_MS);
  });
  try {
    const neverAnswered = getSetting<unknown>(LEDGER_CHAT_OPT_IN_KEY).then((v) => v === null);
    return await Promise.race([neverAnswered, stalled]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
