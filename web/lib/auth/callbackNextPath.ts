import { ALLOWED_NEXT_PATHS, parseSameOriginPath, toRelativePath } from '@web/lib/auth/redirect';

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

function isAllowedCallbackPathname(pathname: string): boolean {
  return (
    ALLOWED_NEXT_PATHS.has(pathname) ||
    CALLBACK_ONLY_PATHS.has(pathname) ||
    ONBOARDING_PATHS.has(pathname)
  );
}

/** Preserves query string and hash when the path is on the callback allowlist. */
export function sanitizeCallbackNextPath(raw: string | null): string | null {
  const parsed = parseSameOriginPath(raw);
  if (parsed === null || !isAllowedCallbackPathname(parsed.pathname)) return null;
  return toRelativePath(parsed);
}

/** @deprecated Use sanitizeCallbackNextPath — kept for existing tests. */
export const _sanitizeCallbackNextPath = sanitizeCallbackNextPath;
