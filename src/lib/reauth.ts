/**
 * A signed-in user sent to sign in again before an irreversible action.
 *
 * delete-account requires a fresh sign-in on the presenting session (the `amr`
 * gate). On `reauth_required` both clients send the still-signed-in user to
 * `/login?…reason=reauth`, so that one auth route must stay reachable while
 * signed in; every other signed-in visit to /login is still redirected away.
 *
 * The detour must then FINISH the deletion: after the fresh sign-in both
 * platforms return to Settings at DELETE_RESUME_PATH, which re-opens a distinct
 * "Signed in again" confirmation. A sign-in alone never deletes anything.
 */
export function isReauthRequest(pathname: string, reason: string | null | undefined): boolean {
  return pathname === '/login' && reason === 'reauth';
}

/** Where a re-auth sign-in returns to so the pending deletion can be confirmed again. */
export const DELETE_RESUME_PATH = '/settings?action=delete';

/**
 * How long a started re-auth detour may take to come back. A deep link
 * (`smokeledger://settings?action=delete`) can be sent by anyone, so the resume
 * param alone proves nothing: Settings honours it only while a record this
 * device wrote before the detour is still unexpired (see lib/deleteIntent.ts).
 */
export const DELETE_INTENT_TTL_MS = 10 * 60 * 1000;

export interface DeleteIntent {
  /** The deletion ends a consent withdrawal (its audit row is written after success). */
  withdraw: boolean;
}

export function encodeDeleteIntent(withdraw: boolean, userId: string, now: number): string {
  return JSON.stringify({ expiresAt: now + DELETE_INTENT_TTL_MS, withdraw, userId });
}

/**
 * null = not a valid, unexpired record for this user. Malformed or far-future values are
 * refused; a record written for another user (left over across a sign-out/sign-in) is too.
 */
export function decodeDeleteIntent(raw: string | null, userId: string, now: number): DeleteIntent | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { expiresAt, withdraw, userId: owner } = parsed as {
    expiresAt?: unknown;
    withdraw?: unknown;
    userId?: unknown;
  };
  if (typeof expiresAt !== 'number' || typeof withdraw !== 'boolean') return null;
  if (!userId || owner !== userId) return null;
  if (!(expiresAt > now && expiresAt <= now + DELETE_INTENT_TTL_MS)) return null;
  return { withdraw };
}

/** Query flag the post-deletion landing (web) / login (mobile) screens read once. */
export const ACCOUNT_DELETED_PARAM = 'deleted';
