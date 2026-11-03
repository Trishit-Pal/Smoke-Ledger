// The device-side proof that a delete re-auth detour was started here, by this user.
// Pure decisions live in lib/reauth.ts; this only moves the record in and out
// of SecureStore.

import { getSupabase } from '@/lib/supabase';
import { decodeDeleteIntent, encodeDeleteIntent, type DeleteIntent } from '@/lib/reauth';
import { readDeleteIntent, removeDeleteIntent, writeDeleteIntent } from '@/lib/secureStore';

/** The signed-in user's id from the stored session (no network); null when signed out. */
async function currentUserId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}

/** Record the detour before leaving for sign-in. false = could not store it (do not detour). */
export async function beginDeleteDetour(withdraw: boolean, now = Date.now()): Promise<boolean> {
  try {
    const userId = await currentUserId();
    if (!userId) return false;
    await writeDeleteIntent(encodeDeleteIntent(withdraw, userId, now));
    return true;
  } catch {
    return false;
  }
}

/**
 * Settings calls this when it sees ?action=delete. The record is consumed
 * whether or not it is valid, so a link can never be replayed against it.
 * Any storage failure resolves null: no record, no prompt.
 */
export async function takeDeleteResume(now = Date.now()): Promise<DeleteIntent | null> {
  try {
    const raw = await readDeleteIntent();
    const userId = await currentUserId();
    return userId ? decodeDeleteIntent(raw, userId, now) : null;
  } catch {
    return null;
  } finally {
    await removeDeleteIntent().catch(() => undefined);
  }
}
