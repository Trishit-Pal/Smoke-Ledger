import {
  revalidateAppViews,
  revalidateBrands,
} from '@web/app/(app)/_actions/revalidate';

/*
 * Best-effort Router-Cache revalidation after a mutation.
 *
 * The DB write is the source of truth. `revalidateAppViews` / `revalidateBrands`
 * are `'use server'` actions; when a browser runs a stale build (deployment
 * skew), the action's id no longer matches the live deployment and the call
 * THROWS. That must never be reported as a failed mutation — the write already
 * succeeded (this was the "log saved but shows a red error, and new entries
 * don't appear" bug). These wrappers swallow + warn so callers can `await`
 * them safely and still reach their `router.refresh()`.
 *
 * Vercel Skew Protection (via next.config `deploymentId`) prevents the skew in
 * the first place; these wrappers are the belt-and-braces layer that also
 * covers any transient action failure.
 */

export async function safeRevalidateAppViews(): Promise<void> {
  try {
    await revalidateAppViews();
  } catch (err) {
    console.warn('[revalidate] app views — non-fatal (likely deployment skew):', err);
  }
}

export async function safeRevalidateBrands(): Promise<void> {
  try {
    await revalidateBrands();
  } catch (err) {
    console.warn('[revalidate] brands — non-fatal (likely deployment skew):', err);
  }
}
