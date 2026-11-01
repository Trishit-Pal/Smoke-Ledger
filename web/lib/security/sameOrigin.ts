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
/**
 * Route-handler adapter over `isSameOriginRequest`: reads the same three
 * headers the server-action path checks (`x-forwarded-host` wins over `host`
 * behind Vercel's proxy). Every API route that mutates on behalf of a cookie
 * session calls this first; SameSite=Lax alone is not a CSRF control.
 */
export function requireSameOrigin(request: Request): boolean {
  const h = request.headers;
  return isSameOriginRequest({
    secFetchSite: h.get('sec-fetch-site'),
    origin: h.get('origin'),
    host: h.get('x-forwarded-host') ?? h.get('host'),
  });
}

export function isSameOriginRequest({ secFetchSite, origin, host }: RequestOriginHeaders): boolean {
  if (secFetchSite) return secFetchSite === 'same-origin';
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
