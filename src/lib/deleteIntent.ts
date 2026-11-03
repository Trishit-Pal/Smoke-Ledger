// The device-side proof that a delete re-auth detour was started here.
// Pure decisions live in lib/reauth.ts; this only moves the record in and out
// of SecureStore.

import { decodeDeleteIntent, encodeDeleteIntent, type DeleteIntent } from '@/lib/reauth';
import { readDeleteIntent, removeDeleteIntent, writeDeleteIntent } from '@/lib/secureStore';

/** Record the detour before leaving for sign-in. false = could not store it (do not detour). */
export async function beginDeleteDetour(withdraw: boolean, now = Date.now()): Promise<boolean> {
  try {
    await writeDeleteIntent(encodeDeleteIntent(withdraw, now));
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
    return decodeDeleteIntent(raw, now);
  } catch {
    return null;
  } finally {
    await removeDeleteIntent().catch(() => undefined);
  }
}
