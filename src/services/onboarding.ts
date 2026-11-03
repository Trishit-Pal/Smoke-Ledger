// The onboarding wizard's step writes, shared by the web pages
// (web/app/onboarding/*) and the Expo screens (app/onboarding/*) so re-entry
// semantics cannot drift between platforms.
//
// Invariants every step keeps:
//   - Server is the source of truth; the in-memory draft only holds un-saved
//     input. `load*` seeds a step from what was saved so Back/refresh/re-login
//     show the real values.
//   - Each step's data and the step advance go in ONE user_profiles row update,
//     and the DB trigger keeps `onboarding_step` monotonic, so re-submitting an
//     earlier step is idempotent.
//   - Consent is a fresh decision (boxes are never pre-filled), but a re-tick at
//     the same legal versions writes nothing new to the profile or the audit log.

import type { Goal, GoalType, UserProfile } from '@/types';
import { AppError } from '@/lib/errors';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { OnboardingUsageSchema, parseOrThrow, type OnboardingUsageInput } from '@/lib/validation';
import {
  getProfile,
  saveComplianceConsents,
  setOnboardingStep,
  updateProfile,
} from '@/db/repositories/profile';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { createGoal, listAllGoals, setGoalStatus, updateGoal } from '@/db/repositories/goals';
import { buildGoalPayload, goalToFormState, type GoalFormState } from '@/domain/goalForm';
import { recordAuditEvent } from '@/services/audit';
import { invalidateAnalyticsConsentCache, track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import type { PurchasePref } from '@/store/onboardingDraft';

/* ---------- Step 01 · consent ---------- */

/** True when the profile already holds every required consent at the current legal versions. */
export function consentsCurrent(profile: UserProfile | null | undefined): boolean {
  return Boolean(
    profile?.ageConfirmedAt &&
      profile?.dataProcessingConsentAt &&
      profile?.termsVersion === LEGAL_VERSIONS.terms &&
      profile?.privacyVersion === LEGAL_VERSIONS.privacy &&
      profile?.healthDisclaimerVersion === LEGAL_VERSIONS.medicalDisclaimer,
  );
}

export interface ConsentStepInput {
  /**
   * `consentsCurrent(savedProfile)` — computed where the profile already is
   * (the server on web, `useSession` on mobile) so the page never has to ship
   * the whole profile to the client.
   */
  alreadyConsented: boolean;
  analyticsOptIn: boolean;
  /**
   * The separate, unticked-by-default health-data consent (GDPR Art 9(2)(a)).
   * Required: without it the step refuses to continue. Independent of analytics.
   */
  healthDataConsent: boolean;
}

/**
 * Record the required consents once per legal version and advance to usage.
 * A re-tick at the same versions only refreshes the analytics preference.
 * Never writes `marketing_consent_at`: analytics opt-in is not marketing consent.
 */
export async function submitConsentStep({
  alreadyConsented,
  analyticsOptIn,
  healthDataConsent,
}: ConsentStepInput): Promise<void> {
  if (!healthDataConsent) {
    throw new AppError('validation_error', 'Validation failed: health-data consent is required');
  }
  const now = new Date().toISOString();
  if (!alreadyConsented) {
    // Audit first. If the profile write then fails the user retries and a
    // duplicate audit row is possible; if the order were reversed, an audit
    // failure after the write would leave the consent unrecorded forever
    // (a reload sees a current profile and skips the audit).
    await recordAuditEvent('consent_accepted', 'compliance', {
      termsVersion: LEGAL_VERSIONS.terms,
      privacyVersion: LEGAL_VERSIONS.privacy,
    });
  }
  const profileWrite = alreadyConsented
    ? setOnboardingStep('usage')
    : saveComplianceConsents({
        ageConfirmedAt: now,
        termsVersion: LEGAL_VERSIONS.terms,
        privacyVersion: LEGAL_VERSIONS.privacy,
        healthDisclaimerVersion: LEGAL_VERSIONS.medicalDisclaimer,
        dataProcessingConsentAt: now,
        healthDataConsentAt: now,
        onboardingStep: 'usage',
      });
  await Promise.all([
    profileWrite,
    setSetting('consent.termsVersion', LEGAL_VERSIONS.terms),
    setSetting('consent.privacyVersion', LEGAL_VERSIONS.privacy),
    setSetting('consent.medicalDisclaimerVersion', LEGAL_VERSIONS.medicalDisclaimer),
    setSetting('consent.analyticsOptIn', analyticsOptIn),
  ]);
  invalidateAnalyticsConsentCache();
}

export interface AcceptChangedTermsInput {
  /** The profile has no `health_data_consent_at`: ask for it, and stamp it. */
  needsHealthConsent: boolean;
  healthDataConsent: boolean;
}

/**
 * The /consent screen for someone who already consented and is onboarded: stamp
 * the current versions (and the health-data consent if it was never given) and
 * audit once. Deliberately a separate write from `submitConsentStep`: it carries
 * no `onboardingStep`, so asking again can never move the wizard, and it leaves
 * the analytics preference alone.
 */
export async function acceptChangedTerms({
  needsHealthConsent,
  healthDataConsent,
}: AcceptChangedTermsInput): Promise<void> {
  if (needsHealthConsent && !healthDataConsent) {
    throw new AppError('validation_error', 'Validation failed: health-data consent is required');
  }
  await recordAuditEvent('consent_accepted', 'compliance', {
    termsVersion: LEGAL_VERSIONS.terms,
    privacyVersion: LEGAL_VERSIONS.privacy,
  });
  await Promise.all([
    saveComplianceConsents({
      termsVersion: LEGAL_VERSIONS.terms,
      privacyVersion: LEGAL_VERSIONS.privacy,
      healthDisclaimerVersion: LEGAL_VERSIONS.medicalDisclaimer,
      ...(needsHealthConsent ? { healthDataConsentAt: new Date().toISOString() } : {}),
    }),
    setSetting('consent.termsVersion', LEGAL_VERSIONS.terms),
    setSetting('consent.privacyVersion', LEGAL_VERSIONS.privacy),
    setSetting('consent.medicalDisclaimerVersion', LEGAL_VERSIONS.medicalDisclaimer),
  ]);
}

/* ---------- Step 02 · baseline ---------- */

export interface UsageDraft {
  perDay: number;
  windowDays: 7 | 30;
  purchasePref: PurchasePref | null;
}

/** The saved profile plus the baseline values, or `draft: null` when the step was never saved. */
export async function loadUsageStep(): Promise<{ profile: UserProfile; draft: UsageDraft | null }> {
  const [profile, typicalDaily, purchasePref] = await Promise.all([
    getProfile(),
    getSetting<number>('onboarding.typicalDaily'),
    getSetting<PurchasePref>('onboarding.purchasePref'),
  ]);
  const perDay = typicalDaily ?? profile.baselinePerDay;
  if (perDay == null) return { profile, draft: null };
  return {
    profile,
    draft: {
      perDay,
      windowDays: profile.baselineWindowDays === 7 ? 7 : 30,
      purchasePref: purchasePref ?? null,
    },
  };
}

/** Save the baseline and advance to goal (profile columns + step in one UPDATE). */
export async function submitUsageStep(input: OnboardingUsageInput): Promise<void> {
  const v = parseOrThrow(OnboardingUsageSchema, input, 'onboarding_usage');
  await Promise.all([
    updateProfile({
      baselinePerDay: v.perDay,
      baselineWindowDays: v.windowDays,
      onboardingStep: 'goal',
    }),
    setSetting('onboarding.typicalDaily', v.perDay),
    setSetting('onboarding.purchasePref', v.purchasePref),
  ]);
}

/* ---------- Step 03 · goal ---------- */

export const ONBOARDING_GOAL_TYPES: readonly GoalType[] = [
  'daily_cap',
  'spend_cap_daily',
  'no_smoke_window',
];

export interface GoalDraft {
  /** The active goal set earlier in this onboarding, if any. */
  existing: Goal | null;
  goalType: GoalType | null;
  goalTarget: string;
}

/** The goal saved earlier in onboarding (newest active one of the offered types), as draft values. */
export async function loadGoalStep(): Promise<GoalDraft> {
  const goals = await listAllGoals(); // newest first
  const existing =
    goals.find((g) => g.status === 'active' && ONBOARDING_GOAL_TYPES.includes(g.type)) ?? null;
  if (!existing) return { existing: null, goalType: null, goalTarget: '' };
  return { existing, goalType: existing.type, goalTarget: goalToFormState(existing).target };
}

/**
 * Create or edit the onboarding goal, then advance to brands.
 * Same type as `existing` → update its target. Different type → create the new
 * one first (a failed create changes nothing), then abandon EVERY other active
 * goal of the offered types — not just `existing` — so a retry after any
 * half-failure (abandon or step write failed) heals to exactly one active goal.
 * Callers re-read `loadGoalStep()` on failure so a retry edits a goal that was
 * already created instead of creating it twice.
 */
export async function submitGoalStep(form: GoalFormState, existing: Goal | null): Promise<Goal> {
  const result = buildGoalPayload(form, []);
  if (!result.ok) throw new AppError('validation_error', result.error);
  const { payload } = result;

  let goal: Goal;
  if (existing && existing.type === payload.type) {
    goal = await updateGoal(existing.id, {
      targetValue: payload.targetValue,
      meta: payload.meta ?? null,
    });
  } else {
    goal = await createGoal(payload);
    // Analytics never gates the step (track swallows its own errors).
    void track(AnalyticsEvents.GOAL_CREATED, { type: goal.type });
  }
  const strays = (await listAllGoals()).filter(
    (g) => g.id !== goal.id && g.status === 'active' && ONBOARDING_GOAL_TYPES.includes(g.type),
  );
  for (const stray of strays) await setGoalStatus(stray.id, 'abandoned');
  await setOnboardingStep('brands');
  return goal;
}

/** Skip (or keep an existing goal) and advance to brands. Throws so the UI can show the failure. */
export async function skipGoalStep(): Promise<void> {
  await setOnboardingStep('brands');
}

/* ---------- Step 04 · finish ---------- */

/** Mark the account onboarded (onboarded_at + step 'done' in one UPDATE). */
export async function finishOnboarding(): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all([
    updateProfile({ onboardedAt: now, onboardingStep: 'done' }),
    setSetting('consent.onboardingCompletedAt', now),
  ]);
  // Audit is compliance bookkeeping, not a gate: a transient audit failure must
  // never strand the user on the final step.
  try {
    await recordAuditEvent('onboarding_completed', 'compliance', {});
  } catch (auditErr) {
    console.warn('[onboarding] onboarding_completed audit failed', auditErr);
  }
}
