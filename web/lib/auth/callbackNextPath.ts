import { ALLOWED_NEXT_PATHS } from '@web/lib/auth/redirect';

const CALLBACK_ONLY_PATHS: ReadonlySet<string> = new Set(['/reset-password']);

const ONBOARDING_PATHS: ReadonlySet<string> = new Set([
  '/onboarding',
  '/onboarding/baseline',
  '/onboarding/brands',
  '/onboarding/goal',
  '/onboarding/privacy',
  '/onboarding/setup',
  '/onboarding/usage',
]);

/** Explicit onboarding paths allowed as post-callback ?next= targets. */
export const CALLBACK_ONBOARDING_PATHS = ONBOARDING_PATHS;

function extractAllowedCallbackPathname(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(raw)) return null;
  let pathname: string;
  try {
    pathname = new URL(raw, 'https://x').pathname;
  } catch {
    return null;
  }
  if (ALLOWED_NEXT_PATHS.has(pathname)) return pathname;
  if (CALLBACK_ONLY_PATHS.has(pathname)) return pathname;
  if (ONBOARDING_PATHS.has(pathname)) return pathname;
  return null;
}

/** Preserves query string and hash when the path is on the callback allowlist. */
export function sanitizeCallbackNextPath(raw: string | null): string | null {
  const pathname = extractAllowedCallbackPathname(raw);
  if (pathname === null) return null;
  return raw!;
}

/** @deprecated Use sanitizeCallbackNextPath — kept for existing tests. */
export const _sanitizeCallbackNextPath = sanitizeCallbackNextPath;
