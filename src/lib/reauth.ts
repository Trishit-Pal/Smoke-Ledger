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

/** Query flag the post-deletion landing (web) / login (mobile) screens read once. */
export const ACCOUNT_DELETED_PARAM = 'deleted';
