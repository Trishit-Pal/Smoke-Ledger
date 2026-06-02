// Shared, non-'use server' types/copy for the auth rate-limit prechecks.
//
// A 'use server' module may only export async functions, so the result shape
// and the user-facing message live here (same split as loginActionState.ts).

export interface PrecheckResult {
  ok: boolean;
  message?: string;
}

export const RATE_LIMITED_MESSAGE =
  'Too many attempts. Please wait a few minutes and try again.';
