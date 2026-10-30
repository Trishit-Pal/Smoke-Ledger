// Step-up check for irreversible actions (account deletion). Kept free of Deno
// globals so jest can import it.
//
// It reads the `amr` (authentication methods) claim of the access token that
// presented the request: when THIS session last proved a credential. The
// account-wide `last_sign_in_at` is not session-bound, so a stale stolen session
// passed whenever the owner signed in elsewhere.
//
// The claims are decoded without re-checking the signature. That is only safe
// because callers run it after the token was verified (verify_jwt = true at the
// gateway, then auth.getUser()). Never use it on an unverified token.

// Allowlist, not denylist: a method Supabase adds later must not count until
// someone decides it proves a credential. token_refresh and anonymous never do.
const SIGN_IN_METHODS: ReadonlySet<string> = new Set([
  'password',
  'otp',
  'magiclink',
  'recovery',
  'email/signup',
  'invite',
  'oauth',
  'sso/saml',
  'totp',
]);

// Tolerated clock skew between the Auth server and this function, in seconds.
const MAX_FUTURE_SKEW_SEC = 60;

function decodeClaims(authHeader: string): unknown {
  // The scheme is case-insensitive, as it is for auth.getUser().
  const match = /^bearer\s+(\S+)$/i.exec(authHeader.trim());
  const payload = match?.[1].split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
  } catch {
    return null;
  }
}

/** True when the presenting session signed in with a real credential within `windowMin` minutes. */
export function hasRecentSignIn(
  authHeader: string | null,
  nowMs: number,
  windowMin: number,
): boolean {
  if (!authHeader || !Number.isFinite(windowMin) || windowMin <= 0) return false;

  const claims = decodeClaims(authHeader);
  const amr = (claims as { amr?: unknown } | null)?.amr;
  if (!Array.isArray(amr)) return false;

  const nowSec = nowMs / 1000;
  return amr.some((entry: { method?: unknown; timestamp?: unknown }) => {
    if (typeof entry?.method !== 'string' || !SIGN_IN_METHODS.has(entry.method)) return false;
    if (typeof entry.timestamp !== 'number') return false;
    const ageSec = nowSec - entry.timestamp;
    return ageSec >= -MAX_FUTURE_SKEW_SEC && ageSec <= windowMin * 60;
  });
}
