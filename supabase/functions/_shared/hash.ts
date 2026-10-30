// Shared crypto helpers for Edge Functions.

/**
 * Returns the lowercase-hex SHA-256 digest of `input`.
 *
 * Used to obfuscate user identifiers (peppered with `AUDIT_PEPPER`) before
 * writing to long-lived audit rows and to hash IP addresses before keying the
 * rate limiter. The result is deterministic for a given input + pepper, which
 * is what enables ops to correlate two events for the same user without ever
 * storing the raw identifier.
 *
 * F3 consolidation: was inlined into `delete-account/index.ts` and
 * `audit-record/index.ts`. Identical implementations.
 */
export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The one way identifiers are hashed before they reach a long-lived row or a
 * rate-limit key: `sha256("<value>:<AUDIT_PEPPER>")`, the form documented in
 * docs/runbooks/audit-pepper-rotation.md. An unpeppered hash of an IPv4 address
 * or phone number is reversible by enumeration, so never call sha256Hex on those.
 */
export function hashWithPepper(value: string, pepper: string): Promise<string> {
  return sha256Hex(`${value}:${pepper}`);
}
