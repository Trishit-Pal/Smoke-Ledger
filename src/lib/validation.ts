// Centralized Zod validation schemas for every user-influenced input that
// can reach the database. Every repository write MUST run input through the
// matching schema before issuing a parameterized statement.
//
// Schemas here are the single source of truth. Keep them in sync with
// `src/types/index.ts` and any CHECK constraints declared in the SQL schema
// (see `src/db/migrations/002_hardening.ts` for idempotent indexes). If you add a new enum value,
// update the DB CHECK and the Zod enum together.

import { z } from 'zod';

import { CONTEXT_OPTIONS } from '@/constants/contexts';
import { MOOD_OPTIONS } from '@/constants/moods';
import { TRIGGER_OPTIONS } from '@/constants/triggers';
import { ONBOARDING_STEP_INDEX } from '@/lib/onboardingSteps';
import type { GoalType, OnboardingStep } from '@/types';

/* ---------- Primitive / shared ---------- */

export const YmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
  .refine(
    (v) => {
      const [y, m, d] = v.split('-').map(Number);
      if (!y || !m || !d) return false;
      if (m < 1 || m > 12 || d < 1 || d > 31) return false;
      // Round-trip via Date.UTC to reject "2025-02-30".
      const dt = new Date(Date.UTC(y, m - 1, d));
      return (
        dt.getUTCFullYear() === y &&
        dt.getUTCMonth() === m - 1 &&
        dt.getUTCDate() === d
      );
    },
    { message: 'Must be a valid calendar date' },
  );

export const IsoUtcSchema = z
  .string()
  .datetime({ offset: true, message: 'Must be an ISO-8601 datetime' });

export const IdSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

/** Soft limit to keep notes from being abused as a blob store. */
const NotesSchema = z
  .string()
  .max(500, 'Notes limited to 500 characters')
  .transform((s) => s.replace(/\u0000/g, '').trim())
  .nullable();

/** Common string sanitizer: strips nulls + trims + enforces length. */
const BoundedString = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/\u0000/g, '').trim())
    .pipe(z.string().min(1).max(max));

/* ---------- Enum tuples ---------- */

const TRIGGER_TAGS = TRIGGER_OPTIONS.map((t) => t.value) as [string, ...string[]];
const MOOD_VALUES = MOOD_OPTIONS.map((m) => m.value) as [string, ...string[]];
const CONTEXT_TAGS = CONTEXT_OPTIONS.map((c) => c.value) as [string, ...string[]];

export const PurchaseModeSchema = z.enum(['single', 'pack', 'carton', 'custom']);
export const PriceSourceSchema = z.enum(['exact', 'estimated', 'inferred', 'unknown']);
export const BrandCategorySchema = z.enum([
  'budget',
  'regular',
  'premium',
  'imported',
  'other',
]);
export const GoalTypeSchema = z.enum([
  'daily_cap',
  'spend_cap_daily',
  'no_smoke_window',
  'reduction_target',
  'weekly_target',
  'quit_date',
  'taper',
]);
export const GoalStatusSchema = z.enum(['active', 'paused', 'completed', 'abandoned']);
export const ReminderKindSchema = z.enum(['daily_summary', 'craving_check', 'goal_nudge', 'quit_streak']);

export const TriggerTagSchema = z.enum(TRIGGER_TAGS);
export const MoodSchema = z.enum(MOOD_VALUES);
export const ContextTagSchema = z.enum(CONTEXT_TAGS);

/* ---------- Cigarette log ---------- */

/** Maximum window a CigaretteLog may be backdated, in milliseconds.
 *  Centralised so the UI (BackdateTimeField) and the Zod cap agree. */
export const MAX_BACKDATE_MS = 24 * 60 * 60 * 1000;

/** Refinement: tsUtc must be ≤ now AND ≥ now - MAX_BACKDATE_MS.
 *  Kept as a standalone function so it can be composed with both
 *  CigaretteLogSchema (via .superRefine) and other shapes that include a
 *  tsUtc field. */
export const backdateCap = (v: { tsUtc: string }, ctx: z.RefinementCtx): void => {
  const ts = Date.parse(v.tsUtc);
  if (!Number.isFinite(ts)) return; // IsoUtcSchema will reject malformed.
  const now = Date.now();
  if (ts > now || ts < now - MAX_BACKDATE_MS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Logs can only be backdated up to 24 hours.',
      path: ['tsUtc'],
    });
  }
};

const CigaretteLogShape = z
  .object({
    brandId: IdSchema.nullable(),
    brandNameSnap: BoundedString(100).nullable(),
    variantSnap: BoundedString(100).nullable(),
    quantity: z.number().int().min(1).max(100),
    purchaseMode: PurchaseModeSchema,
    packSize: z.number().int().min(1).max(100).nullable(),
    totalPriceInr: z.number().min(0).max(10_000).nullable(),
    unitPriceInr: z.number().min(0).max(2_000).nullable(),
    priceSource: PriceSourceSchema,
    triggerTag: TriggerTagSchema.nullable(),
    moodBefore: MoodSchema.nullable(),
    moodAfter: MoodSchema.nullable(),
    craving: z.number().int().min(0).max(10).nullable(),
    contextTag: ContextTagSchema.nullable(),
    notes: NotesSchema,
    tsUtc: IsoUtcSchema,
    localDate: YmdSchema.optional(),
    localHour: z.number().int().min(0).max(23).optional(),
  })
  .strict();

// Cap is enforced both here and in the UI form so a stale state or a future
// mobile client can't stamp a log more than 24h back. We compose the cap as
// a .superRefine on a *derived* schema so the underlying CigaretteLogShape
// retains its .partial() / .extend() for CigaretteLogPatchSchema and
// ImportLogSchema below (Zod's .superRefine / .refine both return ZodEffects
// which loses those methods).
export const CigaretteLogSchema: z.ZodType<CigaretteLogInput> =
  CigaretteLogShape.superRefine(backdateCap);

export type CigaretteLogInput = z.infer<typeof CigaretteLogShape>;

export const CigaretteLogPatchSchema = CigaretteLogShape.partial().strict();

/* ---------- Goals ---------- */

// Sticks stay at 1,000; money (spend caps) is rupees/euros per day, week or month,
// so a weekly cap legitimately passes 1,000. Mirrors goals_target_value_check in
// supabase/migrations/20261105100000_goal_target_by_unit.sql (a test pins both).
export const MAX_STICK_TARGET = 1_000;
export const MAX_MONEY_TARGET = 100_000;
export const maxTargetFor = (type: GoalType): number =>
  type === 'spend_cap_daily' ? MAX_MONEY_TARGET : MAX_STICK_TARGET;

export const GoalSchema = z
  .object({
    type: GoalTypeSchema,
    targetValue: z.number().positive().max(MAX_MONEY_TARGET),
    currentBaseline: z.number().min(0).max(1_000).nullable().optional(),
    startDate: YmdSchema,
    endDate: YmdSchema.nullable().optional(),
    meta: z.record(z.unknown()).nullable().optional(),
  })
  .strict()
  .refine(
    (g) => !g.endDate || g.endDate >= g.startDate,
    { message: 'endDate must be on or after startDate', path: ['endDate'] },
  )
  .refine((g) => g.targetValue <= maxTargetFor(g.type), {
    message: 'targetValue is above the limit for this goal type',
    path: ['targetValue'],
  });

export type GoalInput = z.infer<typeof GoalSchema>;

/**
 * Patch for editing an existing goal's values. Type and startDate are immutable
 * (they anchor the goal's meaning and baseline), so they are not patchable.
 */
export const GoalPatchSchema = z.object({
  // The patch carries no type; the per-type DB CHECK is the authority here.
  targetValue: z.number().positive().max(MAX_MONEY_TARGET).optional(),
  currentBaseline: z.number().min(0).max(1_000).nullable().optional(),
  endDate: YmdSchema.nullable().optional(),
  meta: z.record(z.unknown()).nullable().optional(),
});

export type GoalPatchInput = z.infer<typeof GoalPatchSchema>;

/* ---------- Brands ---------- */

export const BrandSchema = z
  .object({
    name: BoundedString(100),
    category: BrandCategorySchema,
    isFavorite: z.boolean().optional(),
  })
  .strict();

export type BrandInput = z.infer<typeof BrandSchema>;

/**
 * A single INR price (pack MRP or unit price). Capped at ₹2,000 — comfortably
 * above any real cigarette pack — to keep the column from being abused. Reused
 * by the variant schema and the direct price-override repo path. The bounds are
 * exported so UI-layer guards reference one source of truth instead of repeating
 * the literals.
 */
export const MIN_PRICE_INR = 0;
export const MAX_PRICE_INR = 2_000;
export const PriceInrSchema = z.number().min(MIN_PRICE_INR).max(MAX_PRICE_INR);

export const BrandVariantSchema = z
  .object({
    name: BoundedString(100),
    defaultPackSize: z.number().int().min(1).max(100),
    avgPriceInr: PriceInrSchema.nullable(),
  })
  .strict();

export type BrandVariantInput = z.infer<typeof BrandVariantSchema>;

/* ---------- Security / auth ---------- */

export const PinSchema = z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits');

/* ---------- Profile ---------- */

export const GENDER_VALUES = ['male', 'female', 'other', 'undisclosed'] as const;

/**
 * Mirrors the user_profiles.onboarding_step CHECK constraint. Derived from the
 * step-order map so the two TypeScript copies cannot drift; the SQL CHECK and
 * onboarding_step_rank() still have to be widened by hand with it.
 */
export const ONBOARDING_STEP_VALUES = Object.keys(ONBOARDING_STEP_INDEX) as [
  OnboardingStep,
  ...OnboardingStep[],
];

export const ProfileSchema = z
  .object({
    baselinePerDay: z.number().min(0).max(200).nullable().optional(),
    baselineWindowDays: z.number().int().min(1).max(365).optional(),
    discreetMode: z.boolean().optional(),
    appLockEnabled: z.boolean().optional(),
    hideTotalsOnHome: z.boolean().optional(),
    onboardedAt: IsoUtcSchema.nullable().optional(),
    // Written together with a step's data so "save + advance" is one row update.
    onboardingStep: z.enum(ONBOARDING_STEP_VALUES).optional(),
    // Identity — set once at signup (or via the completion form), then immutable
    // server-side. age is derived from dateOfBirth; never stored as a stale int.
    fullName: z.string().trim().min(1).max(80).optional(),
    // YmdSchema also rejects impossible calendar dates (e.g. 2000-02-30), so a
    // bad value fails validation here instead of erroring at the DB cast.
    dateOfBirth: YmdSchema.optional(),
    gender: z.enum(GENDER_VALUES).optional(),
    // Optional, editable in Settings (mobile is rate-limited to once / 30 days).
    // India-only: +91 followed by exactly 10 digits, first digit 6-9.
    mobileE164: z
      .string()
      .regex(
        /^\+91[6-9]\d{9}$/,
        'Enter a valid Indian mobile: +91 followed by 10 digits starting 6-9',
      )
      .nullable()
      .optional(),
    place: z.string().trim().max(80).nullable().optional(),
  })
  .strict();

export type ProfileInput = z.infer<typeof ProfileSchema>;

/** Partial profile updates (repository / settings). */
export const ProfilePatchSchema = ProfileSchema.partial().strict();

/** The onboarding baseline step (`src/services/onboarding.ts`). */
export const OnboardingUsageSchema = z
  .object({
    perDay: z.number().min(0).max(200),
    windowDays: z.union([z.literal(7), z.literal(30)]),
    purchasePref: z.enum(['single', 'pack', 'mixed']),
  })
  .strict();

export type OnboardingUsageInput = z.infer<typeof OnboardingUsageSchema>;

/* ---------- Import envelope ---------- */

export const ImportLogSchema = CigaretteLogShape.extend({
  id: IdSchema,
  localDate: YmdSchema,
  localHour: z.number().int().min(0).max(23),
  createdAt: IsoUtcSchema,
  updatedAt: IsoUtcSchema,
}).strict();

export const ImportBrandSchema = z
  .object({
    id: IdSchema,
    name: BoundedString(100),
    category: BrandCategorySchema,
    isSeed: z.boolean(),
    isFavorite: z.boolean(),
    createdAt: IsoUtcSchema,
    updatedAt: IsoUtcSchema,
    variants: z
      .array(
        z
          .object({
            id: IdSchema,
            brandId: IdSchema,
            name: BoundedString(100),
            defaultPackSize: z.number().int().min(1).max(100),
            avgPriceInr: z.number().min(0).max(2_000).nullable(),
            lastPriceInr: z.number().min(0).max(2_000).nullable(),
            lastPricedAt: IsoUtcSchema.nullable(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();

export const ImportGoalSchema = z
  .object({
    id: IdSchema,
    type: GoalTypeSchema,
    targetValue: z.number().positive().max(MAX_MONEY_TARGET), // the DB CHECK enforces the per-type limit
    currentBaseline: z.number().nullable(),
    startDate: YmdSchema,
    endDate: YmdSchema.nullable(),
    status: GoalStatusSchema,
    meta: z.record(z.unknown()).nullable(),
    createdAt: IsoUtcSchema,
    completedAt: IsoUtcSchema.nullable().optional(),
  })
  .strict();

export const ImportProfileSchema = z
  .object({
    baselinePerDay: z.number().min(0).max(200).nullable(),
    baselineWindowDays: z.number().int().min(1).max(365),
    currency: z.enum(['INR', 'EUR']),
    country: z.string().length(2).nullable().optional(),
    discreetMode: z.boolean(),
    appLockEnabled: z.boolean(),
    hideTotalsOnHome: z.boolean(),
    onboardedAt: IsoUtcSchema.nullable(),
  })
  .strict();

export const EXPORT_SCHEMA_VERSION = 3 as const;

/** Import accepts the current export version and the previous one (v2 had no account block). */
const ACCEPTED_EXPORT_VERSIONS = z.union([z.literal(2), z.literal(EXPORT_SCHEMA_VERSION)]);

/** v3: the sign-in record, read-only context carried in the file (not re-imported). */
export const ImportAccountSchema = z
  .object({
    email: z.string().nullable(),
    phone: z.string().nullable(),
    createdAt: IsoUtcSchema.nullable(),
    lastSignInAt: IsoUtcSchema.nullable(),
  })
  .strict();

export const ImportErrorEventSchema = z
  .object({
    category: z.string(),
    message: z.string(),
    route: z.string().nullable(),
    createdAt: IsoUtcSchema,
  })
  .strict();

export const ImportEnvelopeSchema = z
  .object({
    version: ACCEPTED_EXPORT_VERSIONS,
    exportedAt: IsoUtcSchema,
    profile: ImportProfileSchema,
    brands: z.array(ImportBrandSchema).max(1_000),
    logs: z.array(ImportLogSchema).max(10_000),
    goals: z.array(ImportGoalSchema).max(500),
    settings: z.record(z.unknown()).optional(),
    account: ImportAccountSchema.optional(),
    errorEvents: z.array(ImportErrorEventSchema).max(10_000).optional(),
  })
  .strict();

export type ImportEnvelope = z.infer<typeof ImportEnvelopeSchema>;

/* ---------- Helpers ---------- */

/**
 * Validate and return parsed output, or throw a sanitized Error.
 * Zod's default error dumps the whole input — we scrub it so nothing leaks
 * into logs or analytics.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown, label: string): T {
  const r = schema.safeParse(input);
  if (r.success) return r.data as T;
  const issues = r.error.issues
    .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
    .slice(0, 5)
    .join('; ');
  throw new Error(`Validation failed for ${label}: ${issues}`);
}
