export interface RequestOriginHeaders {
  /** `Sec-Fetch-Site`, sent by every current browser regardless of Referrer-Policy. */
  secFetchSite: string | null;
  origin: string | null;
  /** The host this request was addressed to (`x-forwarded-host` behind a proxy). */
  host: string | null;
}

/**
 * True only for a request a page on our own origin made.
 *
 * Next 14.2 already compares Origin with Host for server actions, but it lets a
 * missing Origin through and rejects `Origin: null` only because
 * `new URL('null')` happens to throw. An action that signs a browser in must
 * not rest on that, so it checks Fetch Metadata first and an exact Origin match
 * second, failing closed on anything else.
 */
export function isSameOriginRequest({ secFetchSite, origin, host }: RequestOriginHeaders): boolean {
  if (secFetchSite) return secFetchSite === 'same-origin';
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
