'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { createClient } from '@web/lib/supabase/server';
import { brandsCacheTag } from '@web/lib/server/data';

// Flushes the Next.js Router Cache for every authenticated app view.
// Pair with `router.refresh()` after a mutation: refresh() re-renders the
// CURRENT route in place; revalidatePath() invalidates the prefetched cache
// so the NEXT navigation to a sibling route serves fresh data instead of the
// stale prefetched payload.
//
// Cost: one server roundtrip per call. The action itself does no I/O — it
// only updates the cache marker — so the latency is essentially the network
// round-trip. Safe to call after every user mutation.
export async function revalidateAppViews(): Promise<void> {
  revalidatePath('/dashboard');
  revalidatePath('/history');
  revalidatePath('/trends');
  revalidatePath('/settings');
  revalidatePath('/log/new');
  revalidatePath('/goals');
}

// Busts the per-user brand+variant Data Cache (getServerBrandsWithVariants)
// after a brand mutation — create, variant upsert, favorite toggle, delete.
// Resolves the user id from the session so only that user's tag is invalidated.
// Call alongside revalidateAppViews() + router.refresh() on brand changes.
export async function revalidateBrands(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) revalidateTag(brandsCacheTag(user.id));
}
