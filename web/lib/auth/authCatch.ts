// Shared catch helpers for the auth Server Actions.
//
// `isNextRedirectError` lets actions re-throw Next's redirect() signal instead
// of swallowing it (next/navigation's redirect() throws an Error whose digest
// starts with 'NEXT_REDIRECT').
//
// `safeAuthCatchState` returns a GENERIC, fixed message for unexpected errors so
// we never echo raw internal error text back to the browser — replacing the
// TEMPORARY `diagnostic_error` branch that returned `err.message` verbatim.
// Log the real error server-side; show the user something safe.

export interface AuthErrorState {
  code: string;
  message: string;
}

const GENERIC_AUTH_FAILURE_MESSAGE =
  'Something went wrong on our side. Please try again in a moment.';

export function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof (err as { digest?: unknown }).digest === 'string' &&
    (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

export function safeAuthCatchState(_err: unknown): AuthErrorState {
  return { code: 'dependency_failure', message: GENERIC_AUTH_FAILURE_MESSAGE };
}
