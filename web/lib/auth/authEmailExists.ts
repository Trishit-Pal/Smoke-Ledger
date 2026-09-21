import { createAdminClient } from '@web/lib/supabase/admin';
import { withTimeout, DEFAULT_AUTH_TIMEOUT_MS } from '@web/lib/auth/withTimeout';

export type EmailPresence = 'present' | 'absent' | 'unknown';

/** Map the auth_email_exists RPC. Any error or non-boolean is unknown — never
 *  invent "unregistered". */
export function presenceFromRpc(data: unknown, error: unknown): EmailPresence {
  if (error || typeof data !== 'boolean') return 'unknown';
  return data ? 'present' : 'absent';
}

/** After invalid_credentials, map presence to a login code. Anything that is
 *  not a definite yes/no stays generic — never invent "unregistered". */
export function classifyInvalidCredentials(
  presence: EmailPresence,
): 'email_not_registered' | 'password_mismatch' | 'invalid_credentials' {
  if (presence === 'absent') return 'email_not_registered';
  if (presence === 'present') return 'password_mismatch';
  return 'invalid_credentials';
}

/**
 * After a failed password sign-in, decide whether the email exists in Auth.
 * Service-role RPC only (GoTrue listUsers cannot filter by email).
 * Total: timeout, throw, missing admin, or RPC error → 'unknown'. Never throws.
 */
export async function lookupAuthEmail(email: string): Promise<EmailPresence> {
  try {
    const admin = createAdminClient();
    if (!admin) return 'unknown';
    const { data, error } = await withTimeout(
      admin.rpc('auth_email_exists', {
        p_email: email.trim().toLowerCase(),
      }),
      DEFAULT_AUTH_TIMEOUT_MS,
    );
    return presenceFromRpc(data, error);
  } catch {
    return 'unknown';
  }
}
