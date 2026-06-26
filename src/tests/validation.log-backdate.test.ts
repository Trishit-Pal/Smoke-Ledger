/*
 * CigaretteLogSchema — backdate cap regression.
 *
 * The cap lives in MAX_BACKDATE_MS in src/lib/validation.ts and is enforced
 * by a `.refine` on CigaretteLogSchema. This test pins the behaviour:
 *
 *   - now is accepted
 *   - 1 hour ago is accepted
 *   - exactly MAX_BACKDATE_MS in the past is accepted (boundary)
 *   - MAX_BACKDATE_MS + 1ms in the past is rejected
 *   - 1 second in the future is rejected
 *   - far in the past is rejected
 *   - malformed tsUtc is rejected (IsoUtcSchema)
 */

import {
  CigaretteLogSchema,
  CigaretteLogPatchSchema,
  ImportLogSchema,
  MAX_BACKDATE_MS,
} from '@/lib/validation';

function baseLog(overrides: Record<string, unknown> = {}) {
  return {
    brandId: 'brd_test',
    brandNameSnap: 'Test Brand',
    variantSnap: null,
    quantity: 1,
    purchaseMode: 'single' as const,
    packSize: null,
    totalPriceInr: 22,
    unitPriceInr: 22,
    priceSource: 'inferred' as const,
    triggerTag: null,
    moodBefore: null,
    moodAfter: null,
    craving: null,
    contextTag: null,
    notes: null,
    tsUtc: new Date().toISOString(),
    ...overrides,
  };
}

describe('CigaretteLogSchema — backdate cap', () => {
  it('accepts a tsUtc of now', () => {
    const result = CigaretteLogSchema.safeParse(baseLog());
    expect(result.success).toBe(true);
  });

  it('accepts a tsUtc 1 hour in the past', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = CigaretteLogSchema.safeParse(baseLog({ tsUtc: oneHourAgo }));
    expect(result.success).toBe(true);
  });

  it('accepts a tsUtc exactly MAX_BACKDATE_MS in the past (boundary)', () => {
    // The cap is `(now - MAX_BACKDATE_MS) <= tsUtc <= now`. The refine reads
    // its OWN `Date.now()` at parse time, so the exact lower edge is only
    // testable with a frozen clock — otherwise any time elapsing between
    // building `boundary` and the parse pushes it just past the window and
    // the assertion can never reliably pass.
    const FIXED = Date.parse('2026-06-20T00:00:00.000Z');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(FIXED);
    try {
      const boundary = new Date(FIXED - MAX_BACKDATE_MS).toISOString();
      const result = CigaretteLogSchema.safeParse(baseLog({ tsUtc: boundary }));
      expect(result.success).toBe(true);
      // Boundary is exactly now - MAX_BACKDATE_MS and within the window.
      expect(Date.parse(boundary)).toBe(FIXED - MAX_BACKDATE_MS);
      expect(Date.parse(boundary)).toBeLessThanOrEqual(Date.now());
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('rejects a tsUtc MAX_BACKDATE_MS + 1ms in the past', () => {
    const justPast = new Date(Date.now() - MAX_BACKDATE_MS - 1).toISOString();
    const result = CigaretteLogSchema.safeParse(baseLog({ tsUtc: justPast }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const tsIssue = result.error.issues.find((i) => i.path[0] === 'tsUtc');
      expect(tsIssue?.message).toMatch(/24 hours/);
    }
  });

  it('rejects a tsUtc 1 second in the future', () => {
    const future = new Date(Date.now() + 1000).toISOString();
    const result = CigaretteLogSchema.safeParse(baseLog({ tsUtc: future }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const tsIssue = result.error.issues.find((i) => i.path[0] === 'tsUtc');
      expect(tsIssue?.message).toMatch(/24 hours/);
    }
  });

  it('rejects a tsUtc far in the past', () => {
    const ancient = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = CigaretteLogSchema.safeParse(baseLog({ tsUtc: ancient }));
    expect(result.success).toBe(false);
  });

  it('rejects a malformed tsUtc (IsoUtcSchema still applies)', () => {
    const result = CigaretteLogSchema.safeParse(baseLog({ tsUtc: 'not-a-date' }));
    expect(result.success).toBe(false);
  });
});

/*
 * The backdate cap is a .superRefine on a *derived* schema, so the cap applies
 * only to CigaretteLogSchema (the new-log create path). Editing an existing log
 * (CigaretteLogPatchSchema) and importing history (ImportLogSchema) derive from
 * the unrefined CigaretteLogShape and MUST accept timestamps older than 24h —
 * otherwise re-importing your own export, or fixing an old entry, would fail.
 * These tests pin that exemption so a future refactor can't silently re-point
 * those schemas at the refined one.
 */
describe('backdate cap exemptions — edit and import paths', () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  it('CigaretteLogPatchSchema accepts a tsUtc older than 24h', () => {
    const result = CigaretteLogPatchSchema.safeParse({ tsUtc: thirtyDaysAgo });
    expect(result.success).toBe(true);
  });

  it('ImportLogSchema accepts a log older than 24h', () => {
    const importLog = {
      ...baseLog({ tsUtc: thirtyDaysAgo }),
      id: 'log_oldimport',
      localDate: '2026-05-26',
      localHour: 10,
      createdAt: thirtyDaysAgo,
      updatedAt: thirtyDaysAgo,
    };
    const result = ImportLogSchema.safeParse(importLog);
    expect(result.success).toBe(true);
  });
});
