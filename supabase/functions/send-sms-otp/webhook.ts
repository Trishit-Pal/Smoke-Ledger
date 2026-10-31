// Standard Webhooks signature verification (https://standardwebhooks.com).
//
// Supabase Auth Send-SMS Hook signs each request with `webhook-signature`
// containing one or more `v1,<base64-hmac>` entries. The signed payload is
// `<webhook-id>.<webhook-timestamp>.<raw body>`. The secret is delivered as
// `v1,whsec_<base64>` from the Dashboard.
//
// Skipping HMAC verification on this function would let anyone hitting its
// public URL trigger MSG91 sends at our cost, so this is mandatory, not
// optional.

interface VerifyArgs {
  /** The signing secret in `v1,whsec_<base64>` or bare `whsec_<base64>` form. */
  secret: string;
  /** The signed payload — `<id>.<timestamp>.<rawBody>`. */
  payload: string;
  /** The raw `webhook-signature` header value. */
  signature: string;
}

function decodeSecret(secret: string): Uint8Array<ArrayBuffer> {
  const stripped = secret.replace(/^v1,whsec_/, '').replace(/^whsec_/, '');
  const binary = atob(stripped);
  // Backed by a plain ArrayBuffer: crypto.subtle.importKey takes a BufferSource,
  // which newer TypeScript lib types no longer accept as Uint8Array<ArrayBufferLike>.
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hmacSha256Base64(keyBytes: Uint8Array<ArrayBuffer>, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const sigBytes = new Uint8Array(sigBuf);
  let asString = '';
  for (let i = 0; i < sigBytes.length; i++) {
    asString += String.fromCharCode(sigBytes[i]);
  }
  return btoa(asString);
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyWebhookSignature(args: VerifyArgs): Promise<boolean> {
  const { secret, payload, signature } = args;
  if (!secret || !signature) return false;

  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    keyBytes = decodeSecret(secret);
  } catch {
    return false;
  }

  const expected = await hmacSha256Base64(keyBytes, payload);

  // Multiple `v1,<sig>` entries can appear during key rotation, space-separated.
  for (const candidate of signature.split(' ')) {
    const parts = candidate.split(',');
    if (parts.length !== 2) continue;
    const [version, sig] = parts;
    if (version !== 'v1' || !sig) continue;
    if (constantTimeEquals(expected, sig)) return true;
  }
  return false;
}
