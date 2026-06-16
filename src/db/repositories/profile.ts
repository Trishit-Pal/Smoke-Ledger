import type { OnboardingStep, UserProfile } from '@/types';
import { parseOrThrow, ProfilePatchSchema } from '@/lib/validation';
import { getSupabase } from '@/lib/supabase';
import { mapDbError, requireUserId } from '@/db/repositories/_supabase';

export type { OnboardingStep };

type Row = {
  id: string;
  // supabase-js returns Postgres `numeric` columns as strings; we coerce in rowToProfile.
  baseline_per_day: string | number | null;
  baseline_window_days: number;
  currency: string;
  discreet_mode: boolean;
  app_lock_enabled: boolean;
  hide_totals_on_home: boolean;
  onboarded_at: string | null;
  onboarding_step?: OnboardingStep | null;
  age_confirmed_at?: string | null;
  terms_version?: string | null;
  privacy_version?: string | null;
  health_disclaimer_version?: string | null;
  data_processing_consent_at?: string | null;
  marketing_consent_at?: string | null;
  full_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  mobile_e164?: string | null;
  mobile_changed_at?: string | null;
  place?: string | null;
};

function rowToProfile(r: Row): UserProfile {
  return {
    // numeric(5,2) is returned as a string by the pg driver; coerce to JS number.
    baselinePerDay: r.baseline_per_day != null ? Number(r.baseline_per_day) : null,
    baselineWindowDays: r.baseline_window_days,
    currency: r.currency as UserProfile['currency'],
    discreetMode: r.discreet_mode,
    appLockEnabled: r.app_lock_enabled,
    hideTotalsOnHome: r.hide_totals_on_home,
    onboardedAt: r.onboarded_at,
    onboardingStep: r.onboarding_step ?? null,
    ageConfirmedAt: r.age_confirmed_at ?? null,
    termsVersion: r.terms_version ?? null,
    privacyVersion: r.privacy_version ?? null,
    healthDisclaimerVersion: r.health_disclaimer_version ?? null,
    dataProcessingConsentAt: r.data_processing_consent_at ?? null,
    marketingConsentAt: r.marketing_consent_at ?? null,
    fullName: r.full_name ?? null,
    dateOfBirth: r.date_of_birth ?? null,
    gender: (r.gender as UserProfile['gender']) ?? null,
    mobileE164: r.mobile_e164 ?? null,
    mobileChangedAt: r.mobile_changed_at ?? null,
    place: r.place ?? null,
  };
}

export async function getProfile(): Promise<UserProfile> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  let { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw mapDbError(error);
  if (!data) {
    const ins = await supabase
      .from('user_profiles')
      .upsert({ id: userId }, { onConflict: 'id' })
      .select('*')
      .single();
    if (ins.error) throw mapDbError(ins.error);
    data = ins.data as Row;
  }

  return rowToProfile(data as Row);
}

export async function updateProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Partial<UserProfile>;
  if (Object.keys(defined).length) {
    parseOrThrow(ProfilePatchSchema, defined, 'profile');
  }
  const supabase = getSupabase();
  const userId = await requireUserId();
  const row: Record<string, unknown> = {};
  if (defined.baselinePerDay !== undefined) row.baseline_per_day = defined.baselinePerDay;
  if (defined.baselineWindowDays !== undefined) row.baseline_window_days = defined.baselineWindowDays;
  if (defined.discreetMode !== undefined) row.discreet_mode = defined.discreetMode;
  if (defined.appLockEnabled !== undefined) row.app_lock_enabled = defined.appLockEnabled;
  if (defined.hideTotalsOnHome !== undefined) row.hide_totals_on_home = defined.hideTotalsOnHome;
  if (defined.onboardedAt !== undefined) row.onboarded_at = defined.onboardedAt;
  // Identity fields: writable once (the DB trigger rejects a second change).
  if (defined.fullName !== undefined) row.full_name = defined.fullName;
  if (defined.dateOfBirth !== undefined) row.date_of_birth = defined.dateOfBirth;
  if (defined.gender !== undefined) row.gender = defined.gender;
  // mobile_e164 is rate-limited by the trigger; mobile_changed_at is server-owned
  // and deliberately never written from the client.
  if (defined.mobileE164 !== undefined) row.mobile_e164 = defined.mobileE164;
  if (defined.place !== undefined) row.place = defined.place;
  if (Object.keys(row).length) {
    const { error } = await supabase.from('user_profiles').update(row).eq('id', userId);
    if (error) throw mapDbError(error);
  }
  return getProfile();
}

export async function markOnboarded(baselinePerDay: number | null): Promise<void> {
  await updateProfile({ baselinePerDay, onboardedAt: new Date().toISOString() });
  await setOnboardingStep('done');
}

/**
 * Persist the next onboarding step. Used by middleware to gate access so a
 * user cannot skip the privacy or baseline pages by typing a deeper URL.
 */
export async function setOnboardingStep(step: OnboardingStep): Promise<void> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  const { error } = await supabase
    .from('user_profiles')
    .update({ onboarding_step: step })
    .eq('id', userId);
  if (error) throw mapDbError(error);
}

export interface ComplianceConsentPatch {
  ageConfirmedAt?: string | null;
  termsVersion?: string | null;
  privacyVersion?: string | null;
  healthDisclaimerVersion?: string | null;
  dataProcessingConsentAt?: string | null;
  marketingConsentAt?: string | null;
}

export async function saveComplianceConsents(patch: ComplianceConsentPatch): Promise<void> {
  const supabase = getSupabase();
  const userId = await requireUserId();
  const row: Record<string, unknown> = {};

  if (patch.ageConfirmedAt !== undefined) row.age_confirmed_at = patch.ageConfirmedAt;
  if (patch.termsVersion !== undefined) row.terms_version = patch.termsVersion;
  if (patch.privacyVersion !== undefined) row.privacy_version = patch.privacyVersion;
  if (patch.healthDisclaimerVersion !== undefined) {
    row.health_disclaimer_version = patch.healthDisclaimerVersion;
  }
  if (patch.dataProcessingConsentAt !== undefined) {
    row.data_processing_consent_at = patch.dataProcessingConsentAt;
  }
  if (patch.marketingConsentAt !== undefined) row.marketing_consent_at = patch.marketingConsentAt;

  if (!Object.keys(row).length) return;

  const { error } = await supabase.from('user_profiles').update(row).eq('id', userId);
  if (error) throw mapDbError(error);
}
