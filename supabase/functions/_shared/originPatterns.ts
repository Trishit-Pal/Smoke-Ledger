// Origin patterns kept free of Deno globals so they can be unit tested under jest.

/**
 * This project's own Vercel deployments only: the production alias plus every
 * `smoke-ledger-<hash|git-branch>-<team>` preview. A bare `*.vercel.app` match
 * would let any Vercel user's site pass the allowlist.
 */
export const PREVIEW_ORIGIN_REGEX =
  /^https:\/\/smoke-ledger(-[a-z0-9-]+)?-trishitworks-projects\.vercel\.app$/;
