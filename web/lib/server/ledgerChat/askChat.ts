import { createClient } from '@web/lib/supabase/server';
import { isLedgerChatEnabled } from '@web/lib/server/ledgerChat/enabled';

/**
 * Whether a consent screen should ask the Ask the ledger Yes / No: the chat is enabled for this
 * build AND the reader has never answered, meaning no settings row exists at all. Any stored value
 * counts as an answer: a decline (JSON false) and a stale-version string are not asked here.
 *
 * It reads the row itself rather than through getServerSetting, which maps every falsy value_json
 * (including a stored decline) to null and so cannot tell "never answered" from "declined".
 * Never throws: an unreadable row or session means no ask, so a hiccup can only skip the question,
 * never block sign-up.
 */
export async function shouldAskChat(): Promise<boolean> {
  if (!isLedgerChatEnabled()) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return false;
    const { data, error } = await supabase
      .from('settings_kv')
      .select('value_json')
      .eq('user_id', user.id)
      .eq('key', 'consent.ledgerChatOptIn')
      .maybeSingle();
    if (error) return false;
    return data === null;
  } catch {
    return false;
  }
}
