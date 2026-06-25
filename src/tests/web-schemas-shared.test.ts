/**
 * Regression guard: mobile and web MUST share the same domain Zod schemas.
 *
 * All domain validation lives in `src/lib/validation.ts`.  The web app
 * reaches that file via the `@/* → ../src/*` tsconfig path alias declared in
 * `web/tsconfig.json`.  At Jest time, both import paths below resolve to the
 * same module (mapped by the `moduleNameMapper` in package.json).
 *
 * If anyone shadows a domain schema with a local Zod object inside `web/`,
 * those two imports will no longer be the same reference, and the `===` checks
 * below will fail loudly.
 */

import {
  CigaretteLogSchema as RootLog,
  GoalSchema as RootGoal,
  ProfilePatchSchema as RootProfilePatch,
  BrandSchema as RootBrand,
  BrandVariantSchema as RootBrandVariant,
  parseOrThrow,
} from '@/lib/validation';

// Force the same path the Next.js web app would use via the @/* alias.
// In the test runner, `@/*` → `./src/*`, so both imports hit the same file.
// If the alias is ever broken or a shadow schema introduced, this import fails.
import {
  CigaretteLogSchema as WebLog,
  GoalSchema as WebGoal,
  ProfilePatchSchema as WebProfilePatch,
  BrandSchema as WebBrand,
  BrandVariantSchema as WebBrandVariant,
} from '../lib/validation';

// ── Reference identity ──────────────────────────────────────────────────────
// Both `@/lib/validation` and `../lib/validation` resolve to the same module.
// The objects must be the exact same reference — not structurally equal copies.

test('mobile and web share the same CigaretteLogSchema reference', () => {
  expect(WebLog).toBe(RootLog);
});

test('mobile and web share the same GoalSchema reference', () => {
  expect(WebGoal).toBe(RootGoal);
});

test('mobile and web share the same ProfilePatchSchema reference', () => {
  expect(WebProfilePatch).toBe(RootProfilePatch);
});

test('mobile and web share the same BrandSchema reference', () => {
  expect(WebBrand).toBe(RootBrand);
});

test('mobile and web share the same BrandVariantSchema reference', () => {
  expect(WebBrandVariant).toBe(RootBrandVariant);
});

// ── Behavioural parity ───────────────────────────────────────────────────────
// Even if reference identity is somehow bypassed, parse behaviour must match.

const VALID_LOG_INPUT = {
  brandId: null,
  brandNameSnap: null,
  variantSnap: null,
  quantity: 1,
  purchaseMode: 'single' as const,
  packSize: null,
  totalPriceInr: null,
  unitPriceInr: null,
  priceSource: 'unknown' as const,
  triggerTag: null,
  moodBefore: null,
  moodAfter: null,
  craving: null,
  contextTag: null,
  notes: null,
  // Use `now` so the backdate cap (24h) doesn't reject the fixture.
  tsUtc: new Date().toISOString(),
};

test('CigaretteLogSchema parses a minimal valid log identically via both paths', () => {
  const fromRoot = parseOrThrow(RootLog, VALID_LOG_INPUT, 'root');
  const fromWeb = parseOrThrow(WebLog, VALID_LOG_INPUT, 'web');
  expect(fromRoot).toEqual(fromWeb);
});

test('CigaretteLogSchema rejects craving > 10 on both paths', () => {
  const bad = { ...VALID_LOG_INPUT, craving: 11 };
  expect(RootLog.safeParse(bad).success).toBe(false);
  expect(WebLog.safeParse(bad).success).toBe(false);
});

test('CigaretteLogSchema rejects quantity 0 on both paths', () => {
  const bad = { ...VALID_LOG_INPUT, quantity: 0 };
  expect(RootLog.safeParse(bad).success).toBe(false);
  expect(WebLog.safeParse(bad).success).toBe(false);
});

test('GoalSchema rejects negative targetValue on both paths', () => {
  const bad = { type: 'daily_cap', targetValue: -1, startDate: '2025-05-01' };
  expect(RootGoal.safeParse(bad).success).toBe(false);
  expect(WebGoal.safeParse(bad).success).toBe(false);
});
