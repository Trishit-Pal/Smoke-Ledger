import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

/**
 * Performance / load checks — LOCAL STACK ONLY (enforced below, not just docs).
 *
 * Creates its OWN throwaway confirmed user (so totals are deterministic and the
 * shared RLS test user is never polluted), seeds ~1 year of daily logs, then
 * asserts the hot read paths stay within wall-clock budgets, are correct at volume
 * (SUM(quantity) regression at scale), paginate, and survive a concurrency burst.
 * Deletes the user afterwards (CASCADE).
 *
 * Gated on E2E_SUPABASE_* + SUPABASE_SERVICE_ROLE_KEY AND a localhost URL — it
 * refuses to run against a non-local target so it can never load/seed prod.
 */
const REQUIRED_ENV = [
  'E2E_SUPABASE_URL',
  'E2E_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const URL_ = process.env.E2E_SUPABASE_URL ?? '';
const isLocal = /(?:127\.0\.0\.1|localhost)/.test(URL_);
const hasEnv = REQUIRED_ENV.every((k) => !!process.env[k]);
// Hard local-only guard: never run heavy seeding / load against a remote (prod) DB.
const describeIfLocal = hasEnv && isLocal ? describe : describe.skip;

const DAYS = 365;
const QTY_PER_DAY = 2;
const ID_PREFIX = 'log_perf_';
const SUMMARY_BUDGET_MS = 3000;
const PAGE_BUDGET_MS = 3000;
const CONCURRENCY_BUDGET_MS = 8000;

/** IST-anchored YYYY-MM-DD n days ago — matches the app's local_date bucketing. */
function istYmdDaysAgo(n: number): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  ist.setUTCDate(ist.getUTCDate() - n);
  return ist.toISOString().slice(0, 10);
}

describeIfLocal('performance (local stack)', () => {
  let clientA: SupabaseClient;
  let admin: SupabaseClient;
  let uid: string;

  beforeAll(async () => {
    admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    clientA = createClient(URL_, process.env.E2E_SUPABASE_ANON_KEY!);

    // Dedicated throwaway user → deterministic totals, no shared-user pollution.
    const email = `perf+${Date.now().toString(36)}-${randomUUID().slice(0, 8)}@smoke-ledger-e2e.test`;
    const password = `Pw!${randomUUID().slice(0, 16)}`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Perf Tester', date_of_birth: '1990-01-01', gender: 'undisclosed' },
    });
    expect(created.error).toBeNull();
    uid = created.data.user!.id;

    const signIn = await clientA.auth.signInWithPassword({ email, password });
    expect(signIn.error).toBeNull();

    const stamp = new Date().toISOString();
    const rows = Array.from({ length: DAYS }, (_, i) => {
      const localDate = istYmdDaysAgo(i);
      return {
        id: `${ID_PREFIX}${i}_${uid.slice(0, 8)}`,
        user_id: uid,
        ts_utc: new Date(`${localDate}T09:00:00+05:30`).toISOString(),
        local_date: localDate,
        local_hour: 9,
        quantity: QTY_PER_DAY,
        purchase_mode: 'single',
        price_source: 'unknown',
        created_at: stamp,
        updated_at: stamp,
      };
    });
    const insert = await admin.from('cigarette_logs').insert(rows);
    expect(insert.error).toBeNull();
  }, 60_000);

  afterAll(async () => {
    // Deleting the user CASCADE-removes the seeded logs.
    if (admin && uid) await admin.auth.admin.deleteUser(uid).catch(() => undefined);
    await clientA?.auth.signOut();
  });

  it('get_daily_summary over a year is correct (SUM quantity) and within budget', async () => {
    const t0 = Date.now();
    const { data, error } = await clientA.rpc('get_daily_summary', {
      p_from: istYmdDaysAgo(DAYS - 1),
      p_to: istYmdDaysAgo(0),
    });
    const elapsed = Date.now() - t0;
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const totalSticks = (data as Array<{ sticks: number }>).reduce((a, r) => a + Number(r.sticks), 0);
    // Fresh user → exactly 365 × 2 = 730. Proves SUM(quantity), not COUNT(*), at volume.
    expect(totalSticks).toBe(DAYS * QTY_PER_DAY);
    expect(elapsed).toBeLessThan(SUMMARY_BUDGET_MS);
  });

  it('cigarette_logs pagination caps a page and continues via offset, within budget', async () => {
    const t0 = Date.now();
    const first = await clientA
      .from('cigarette_logs')
      .select('id', { count: 'exact' })
      .eq('user_id', uid)
      .order('ts_utc', { ascending: false })
      .range(0, 199);
    const elapsed = Date.now() - t0;
    expect(first.error).toBeNull();
    expect((first.data ?? []).length).toBeLessThanOrEqual(200);
    expect(elapsed).toBeLessThan(PAGE_BUDGET_MS);

    const second = await clientA
      .from('cigarette_logs')
      .select('id')
      .eq('user_id', uid)
      .order('ts_utc', { ascending: false })
      .range(200, 399);
    expect(second.error).toBeNull();
    expect((second.data ?? []).length).toBeGreaterThan(0); // a year > 200 rows → real 2nd page
  });

  it('survives a concurrency burst of get_daily_summary calls', async () => {
    const t0 = Date.now();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        clientA.rpc('get_daily_summary', { p_from: istYmdDaysAgo(29), p_to: istYmdDaysAgo(0) }),
      ),
    );
    const elapsed = Date.now() - t0;
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(elapsed).toBeLessThan(CONCURRENCY_BUDGET_MS);
  });
});
