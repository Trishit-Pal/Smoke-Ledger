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
 *     profile/logs/goals/brands, leaving prod clean.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + a Supabase URL/anon key (E2E_* preferred,
 * NEXT_PUBLIC_* fallback). When unset, canSeed() is false and authenticated specs
 * skip — so this never runs (and never touches prod) on an unconfigured machine/CI.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

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

/** Teardown: delete the auth user; CASCADE removes all their rows. Best-effort. */
export async function deleteUser(userId: string): Promise<void> {
  const a = getAdmin();
  if (!a) return;
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
