/**
 * E2E seeding + teardown via the Supabase service role.
 *
 * Functional E2E runs against PROD with throwaway, auto-torn-down accounts:
 *   - createConfirmedUser() → auth.admin.createUser({ email_confirm: true }); the
 *     handle_new_user trigger fills the profile (name/DOB/gender) + seeds default
 *     brands, so the account is ready to log in and is FRESH (un-onboarded).
 *   - seedLogs() inserts historical rows directly (service role bypasses RLS) so
 *     timeframe specs have multi-day / multi-quantity data.
 *   - deleteUser() removes the auth user; FK ON DELETE CASCADE wipes their
 *     profile/logs/goals/brands. error_events is SET NULL, so it's deleted
 *     explicitly first. Prod stays clean.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + a Supabase URL/anon key (E2E_* preferred,
 * NEXT_PUBLIC_* fallback). When unset, canSeed() is false and authenticated specs
 * skip — so this never runs (and never touches prod) on an unconfigured machine/CI.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { LEGAL_VERSIONS } from '../../../src/lib/legal';

export interface SeededUser {
  id: string;
  email: string;
  password: string;
}

export const SUPABASE_URL =
  process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const TEST_EMAIL_PREFIX = 'e2e+';

let admin: SupabaseClient | null = null;
export function getAdmin(): SupabaseClient | null {
  if (admin) return admin;
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return admin;
}

/** True when the Supabase URL is a local stack (never a hosted project). */
export function isLocalStack(url: string = SUPABASE_URL): boolean {
  try {
    return ['127.0.0.1', 'localhost'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Every password sign-in shares the app's login rate limit (10/10min per IP, and
 * per-email windows), and e2e signs in from one IP, so a long run trips it. Clear the
 * counters before a sign-in. Local stack + service role only; a no-op everywhere else,
 * so it can never write to a hosted project. The app's limit itself is unchanged.
 */
export async function resetLoginRateLimits(): Promise<void> {
  const a = getAdmin();
  if (!a || !isLocalStack()) return;
  const { error } = await a.from('rate_limit_counters').delete().like('kind', 'pw_login%');
  if (error) throw new Error(`seed: resetLoginRateLimits failed: ${error.message}`);
}

/** True when seeded/authenticated specs can run (service role + url + anon present). */
export function canSeed(): boolean {
  return !!getAdmin() && !!ANON_KEY;
}

function testEmail(tag: string): string {
  const rand = randomUUID().slice(0, 8);
  return `${TEST_EMAIL_PREFIX}${tag}-${Date.now().toString(36)}-${rand}@smoke-ledger-e2e.test`;
}

export interface CreateUserOpts {
  fullName?: string;
  /** YYYY-MM-DD; must be 18+ or the handle_new_user trigger rejects the signup. */
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other' | 'undisclosed';
  password?: string;
}

export async function createConfirmedUser(
  tag = 'user',
  opts: CreateUserOpts = {},
): Promise<SeededUser> {
  const a = getAdmin();
  if (!a) throw new Error('seed: SUPABASE_SERVICE_ROLE_KEY / Supabase URL not configured');
  const email = testEmail(tag);
  const password = opts.password ?? `Pw!${randomUUID().slice(0, 16)}`;
  const { data, error } = await a.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: opts.fullName ?? 'E2E Tester',
      date_of_birth: opts.dateOfBirth ?? '1990-01-01',
      gender: opts.gender ?? 'undisclosed',
    },
  });
  if (error || !data.user) throw new Error(`seed: createUser failed: ${error?.message ?? 'no user'}`);
  return { id: data.user.id, email, password };
}

export interface LogSpec {
  /** YYYY-MM-DD IST calendar date the log belongs to. */
  localDate: string;
  quantity?: number;
  totalPriceInr?: number;
  unitPriceInr?: number;
  localHour?: number;
  brandNameSnap?: string;
}

/** Insert historical logs directly (service role; bypasses RLS). */
export async function seedLogs(userId: string, specs: LogSpec[]): Promise<void> {
  const a = getAdmin();
  if (!a) throw new Error('seed: admin not configured');
  const stamp = new Date().toISOString();
  const rows = specs.map((s) => {
    const hour = s.localHour ?? 9;
    const tsUtc = new Date(
      `${s.localDate}T${String(hour).padStart(2, '0')}:00:00+05:30`,
    ).toISOString();
    return {
      id: randomUUID(),
      user_id: userId,
      ts_utc: tsUtc,
      local_date: s.localDate,
      local_hour: hour,
      quantity: s.quantity ?? 1,
      total_price_inr: s.totalPriceInr ?? null,
      unit_price_inr: s.unitPriceInr ?? null,
      brand_name_snap: s.brandNameSnap ?? 'Test Brand',
      purchase_mode: 'single',
      price_source: s.unitPriceInr != null ? 'exact' : 'unknown',
      created_at: stamp,
      updated_at: stamp,
    };
  });
  const { error } = await a.from('cigarette_logs').insert(rows);
  if (error) throw new Error(`seed: insert logs failed: ${error.message}`);
}

export interface GoalSpec {
  type: string;
  targetValue: number;
  /** YYYY-MM-DD. */
  startDate: string;
  endDate?: string;
  meta?: Record<string, unknown>;
  status?: 'active' | 'paused' | 'completed' | 'abandoned';
}

/** Insert one goal directly (service role). Returns its id. */
export async function seedGoal(userId: string, spec: GoalSpec): Promise<string> {
  const a = getAdmin();
  if (!a) throw new Error('seed: admin not configured');
  const id = `gol_${randomUUID().slice(0, 12)}`;
  const { error } = await a.from('goals').insert({
    id,
    user_id: userId,
    type: spec.type,
    target_value: spec.targetValue,
    start_date: spec.startDate,
    end_date: spec.endDate ?? null,
    status: spec.status ?? 'active',
    meta_json: spec.meta ?? null,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`seed: insert goal failed: ${error.message}`);
  return id;
}

/** The IST calendar date `n` days ago as YYYY-MM-DD (matches the app's todayIst bucketing). */
export function istYmdDaysAgo(n: number): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  ist.setUTCDate(ist.getUTCDate() - n);
  return ist.toISOString().slice(0, 10);
}

/**
 * Stamp the consents + onboarded_at + baseline the middleware checks, so a seeded
 * user lands on /dashboard (not onboarding) after login. `onboardedAt` defaults to
 * now; pass a far-past date (e.g. istYmdDaysAgo(400)) so the dashboard summary floor
 * becomes the full 365-day window and seeded history shows. None of these columns
 * are guarded by the identity-immutability trigger.
 */
export async function markOnboarded(
  userId: string,
  opts: { onboardedAt?: string; baselinePerDay?: number } = {},
): Promise<void> {
  const a = getAdmin();
  if (!a) throw new Error('seed: admin not configured');
  const now = new Date().toISOString();
  const { error } = await a
    .from('user_profiles')
    .update({
      onboarded_at: opts.onboardedAt ?? now,
      onboarding_step: 'done',
      age_confirmed_at: now,
      // Current versions + the health consent, so the re-consent gate leaves a seeded
      // user alone. markConsentOutdated() makes one stale on purpose.
      terms_version: LEGAL_VERSIONS.terms,
      privacy_version: LEGAL_VERSIONS.privacy,
      health_disclaimer_version: LEGAL_VERSIONS.medicalDisclaimer,
      data_processing_consent_at: now,
      health_data_consent_at: now,
      baseline_per_day: opts.baselinePerDay ?? 10,
      baseline_window_days: 30,
    })
    .eq('id', userId);
  if (error) throw new Error(`seed: markOnboarded failed: ${error.message}`);
}

/**
 * Make an onboarded user's consents stale, the way every live user is before they
 * accept the rewrite: an older terms version and no health-data consent.
 */
export async function markConsentOutdated(userId: string): Promise<void> {
  const a = getAdmin();
  if (!a) throw new Error('seed: admin not configured');
  const { error } = await a
    .from('user_profiles')
    .update({ terms_version: '2020-01-01', health_data_consent_at: null })
    .eq('id', userId);
  if (error) throw new Error(`seed: markConsentOutdated failed: ${error.message}`);
}

/**
 * Drop an onboarded user's age and data-processing stamps, the way a legacy row
 * from before those columns existed looks: still onboarded, missing a consent.
 */
export async function clearConsentStamps(userId: string): Promise<void> {
  const a = getAdmin();
  if (!a) throw new Error('seed: admin not configured');
  const { error } = await a
    .from('user_profiles')
    .update({ age_confirmed_at: null, data_processing_consent_at: null })
    .eq('id', userId);
  if (error) throw new Error(`seed: clearConsentStamps failed: ${error.message}`);
}

interface ConsentState {
  terms_version: string | null;
  health_data_consent_at: string | null;
  age_confirmed_at: string | null;
  data_processing_consent_at: string | null;
}

/** The consent columns the re-consent screen writes, read back with the service role. */
export async function readConsentState(userId: string): Promise<ConsentState> {
  const a = getAdmin();
  if (!a) throw new Error('seed: admin not configured');
  const { data, error } = await a
    .from('user_profiles')
    .select('terms_version,health_data_consent_at,age_confirmed_at,data_processing_consent_at')
    .eq('id', userId)
    .single();
  if (error) throw new Error(`seed: readConsentState failed: ${error.message}`);
  return data as ConsentState;
}

/** The saved onboarding step pointer (what the middleware gates on). */
export async function readOnboardingStep(userId: string): Promise<string | null> {
  const a = getAdmin();
  if (!a) throw new Error('seed: admin not configured');
  const { data, error } = await a
    .from('user_profiles')
    .select('onboarding_step')
    .eq('id', userId)
    .single();
  if (error) throw new Error(`seed: readOnboardingStep failed: ${error.message}`);
  return (data as { onboarding_step: string | null }).onboarding_step;
}

/** Goals by status, newest first — to assert "exactly one active" after re-entry. */
export async function listGoalStatuses(
  userId: string,
): Promise<{ type: string; status: string }[]> {
  const a = getAdmin();
  if (!a) throw new Error('seed: admin not configured');
  const { data, error } = await a
    .from('goals')
    .select('type,status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`seed: listGoalStatuses failed: ${error.message}`);
  return (data ?? []) as { type: string; status: string }[];
}

/** How many audit rows of one type the user has (consent must be recorded once per version). */
export async function countAuditEvents(userId: string, eventType: string): Promise<number> {
  const a = getAdmin();
  if (!a) throw new Error('seed: admin not configured');
  const { count, error } = await a
    .from('audit_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', eventType);
  if (error) throw new Error(`seed: countAuditEvents failed: ${error.message}`);
  return count ?? 0;
}

/** Favorite the user's first default brand (the wizard's Finish is disabled at 0). Returns its name. */
export async function seedFavoriteBrand(userId: string): Promise<string | null> {
  const a = getAdmin();
  if (!a) return null;
  const { data } = await a
    .from('brands')
    .select('id,name')
    .eq('user_id', userId)
    .order('name')
    .limit(1);
  const brand = data?.[0] as { id: string; name: string } | undefined;
  if (!brand) return null;
  await a.from('brands').update({ is_favorite: true }).eq('id', brand.id);
  return brand.name;
}

/**
 * Teardown: delete the auth user. FK ON DELETE CASCADE removes profile/logs/goals/
 * brands/etc. — but error_events.user_id is ON DELETE SET NULL, so those rows
 * would survive (anonymized) as orphans; delete them explicitly first. Best-effort.
 */
export async function deleteUser(userId: string): Promise<void> {
  const a = getAdmin();
  if (!a) return;
  try {
    await a.from('error_events').delete().eq('user_id', userId);
  } catch {
    // best-effort
  }
  await a.auth.admin.deleteUser(userId).catch(() => undefined);
}

/**
 * Safety net: count any leftover `e2e+…` accounts (for a teardown self-check —
 * a healthy run leaves zero). Scans up to `maxPages` pages of 200.
 */
export async function countLeftoverTestUsers(maxPages = 5): Promise<number> {
  const a = getAdmin();
  if (!a) return 0;
  let count = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await a.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) break;
    count += data.users.filter((u) => u.email?.startsWith(TEST_EMAIL_PREFIX)).length;
    if (data.users.length < 200) break;
  }
  return count;
}
