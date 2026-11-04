import { getServerSetting } from '@web/lib/server/data';
import { isLedgerChatEnabled } from '@web/lib/server/ledgerChat/enabled';

/**
 * Whether a consent screen should ask the Ask the ledger Yes / No: the chat is enabled for this
 * build AND the reader has never answered (the raw setting is unset). Declined readers (false) and
 * readers holding a stale-version string are not asked here. Never throws: an unreadable setting
 * means no ask, so a hiccup can only skip the question, never block sign-up.
 */
export async function shouldAskChat(): Promise<boolean> {
  if (!isLedgerChatEnabled()) return false;
  try {
    return (await getServerSetting<unknown>('consent.ledgerChatOptIn')) === null;
  } catch {
    return false;
  }
}
