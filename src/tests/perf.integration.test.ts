import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Performance / load checks — LOCAL STACK ONLY (never prod; see qa-runbook.md).
 *
 * Seeds ~1 year of daily logs for the test user, then asserts the hot read paths
 * stay within wall-clock budgets, return correct totals at volume (SUM(quantity)
 * regression at scale), paginate, and survive a small concurrency burst.
 *
 * Gated on the same E2E_SUPABASE_* + user creds as the RLS integration test, plus
 * SUPABASE_SERVICE_ROLE_KEY for volume seeding. Point these at a `supabase start`
 * stack. Skips entirely when unset.
 */
const REQUIRED_ENV = [
  'E2E_SUPABASE_URL',
  'E2E_SUPABASE_ANON_KEY',
  'E2E_USER_A_EMAIL',
  'E2E_USER_A_PASSWORD',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const hasEnv = REQUIRED_ENV.every((k) => !!process.env[k]);
const describeIfEnv = hasEnv ? describe : describe.skip;

const DAYS = 365;
const QTY_PER_DAY = 2;
const ID_PREFIX = 'log_perf_';
// Generous budgets — a local single-node stack, not a tuned prod box.
const SUMMARY_BUDGET_MS = 3000;
const PAGE_BUDGET_MS = 3000;
const CONCURRENCY_BUDGET_MS = 8000;

function ymdDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

describeIfEnv('performance (local stack)', () => {
  let clientA: SupabaseClient;
  let admin: SupabaseClient;
  let uid: string;

  beforeAll(async () => {
    const url = process.env.E2E_SUPABASE_URL!;
    clientA = createClient(url, process.env.E2E_SUPABASE_ANON_KEY!);
    admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signIn = await clientA.auth.signInWithPassword({
      email: process.env.E2E_USER_A_EMAIL!,
      password: process.env.E2E_USER_A_PASSWORD!,
    });
    expect(signIn.error).toBeNull();
    uid = (await clientA.auth.getUser()).data.user!.id;

    const stamp = new Date().toISOString();
    const rows = Array.from({ length: DAYS }, (_, i) => {
      const localDate = ymdDaysAgo(i);
      return {
        id: `${ID_PREFIX}${i}_${uid.slice(0, 8)}`,
        user_id: uid,
        ts_utc: new Date(`${localDate}T09:00:00Z`).toISOString(),
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
    if (admin && uid) {
      await admin.from('cigarette_logs').delete().like('id', `${ID_PREFIX}%`).eq('user_id', uid);
    }
    await clientA?.auth.signOut();
  });

  it('get_daily_summary over a year is correct (SUM quantity) and within budget', async () => {
    const t0 = Date.now();
    const { data, error } = await clientA.rpc('get_daily_summary', {
      p_from: ymdDaysAgo(DAYS - 1),
      p_to: ymdDaysAgo(0),
    });
    const elapsed = Date.now() - t0;
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const totalSticks = (data as Array<{ sticks: number }>).reduce((a, r) => a + Number(r.sticks), 0);
    // 365 seeded days × 2 = 730 — proves SUM(quantity), not COUNT(*), at volume.
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
    expect((second.data ?? []).length).toBeGreaterThan(0); // a year > 200 rows → a real 2nd page
  });

  it('survives a concurrency burst of get_daily_summary calls', async () => {
    const t0 = Date.now();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        clientA.rpc('get_daily_summary', { p_from: ymdDaysAgo(29), p_to: ymdDaysAgo(0) }),
      ),
    );
    const elapsed = Date.now() - t0;
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(elapsed).toBeLessThan(CONCURRENCY_BUDGET_MS);
  });
});
