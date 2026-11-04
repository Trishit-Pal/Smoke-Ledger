/**
 * Functional-suite globalSetup (non-responsive config only): compile the app's routes
 * once so the first spec to touch each one does not pay for a cold `next dev` compile.
 * Without a seedable local stack the specs skip themselves, so there is nothing to warm.
 */
import type { FullConfig } from '@playwright/test';
import { canSeed, isLocalStack } from './seed';
import { warmSignedIn, warmSignedOut } from './warmup';

export default async function globalSetup(config: FullConfig): Promise<void> {
  if (!canSeed() || !isLocalStack()) return;
  const baseURL = config.projects[0].use.baseURL;
  if (!baseURL) return;
  await warmSignedOut(baseURL, ['/login']);
  try {
    await warmSignedIn(baseURL);
  } catch (e) {
    // Warming is an optimisation: a failure must not fail a run the specs may pass.
    console.warn(`e2e warm-up skipped: ${e instanceof Error ? e.message : String(e)}`);
  }
}
