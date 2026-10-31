/**
 * A signed-in user sent to sign in again before an irreversible action.
 *
 * delete-account requires a fresh sign-in on the presenting session (the `amr`
 * gate). On `reauth_required` both clients send the still-signed-in user to
 * `/login?…reason=reauth`, so that one auth route must stay reachable while
 * signed in; every other signed-in visit to /login is still redirected away.
 */
export function isReauthRequest(pathname: string, reason: string | null | undefined): boolean {
  return pathname === '/login' && reason === 'reauth';
}
