'use server';

import { revalidatePath } from 'next/cache';

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
}
