import {
  revalidateAppViews,
  revalidateBrands,
} from '@web/app/(app)/_actions/revalidate';
import { logClientError } from '@/lib/logger';

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

// Failures are telemetered through logClientError (a direct Supabase insert —
// still deliverable on skew, since only server-action ids go stale), so the
// signal that skew is hitting real users reaches error_events instead of
// dying in the browser console. logClientError never throws.
export async function safeRevalidateAppViews(): Promise<void> {
  try {
    await revalidateAppViews();
  } catch (err) {
    await logClientError(err, { category: 'client.revalidate', route: 'app-views' });
  }
}

export async function safeRevalidateBrands(): Promise<void> {
  try {
    await revalidateBrands();
  } catch (err) {
    await logClientError(err, { category: 'client.revalidate', route: 'brands' });
  }
}
