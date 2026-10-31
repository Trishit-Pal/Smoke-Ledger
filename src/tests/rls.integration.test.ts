import { createClient, SupabaseClient } from '@supabase/supabase-js';

const REQUIRED_ENV = [
  'E2E_SUPABASE_URL',
  'E2E_SUPABASE_ANON_KEY',
  'E2E_USER_A_EMAIL',
  'E2E_USER_A_PASSWORD',
  'E2E_USER_B_EMAIL',
  'E2E_USER_B_PASSWORD',
] as const;

const hasEnv = REQUIRED_ENV.every((key) => !!process.env[key]);
const describeIfEnv = hasEnv ? describe : describe.skip;


// Logs are written only through the rate-limited RPC (20261031000000); a direct
// table INSERT is denied to signed-in clients. Returns { data: { id }, error }.
async function insertLogViaRpc(
  client: SupabaseClient,
  id: string,
  tsUtc: string,
  localDate: string,
  localHour: number,
): Promise<{ data: { id: string } | null; error: unknown }> {
  const { data, error } = await client.rpc('create_log_with_rate_limit', {
    p_id: id, p_ts_utc: tsUtc, p_local_date: localDate, p_local_hour: localHour,
    p_brand_id: null, p_brand_name_snap: 'RLS probe', p_variant_snap: null, p_quantity: 1,
    p_purchase_mode: 'single', p_pack_size: null, p_total_price_inr: null, p_unit_price_inr: null,
    p_price_source: 'unknown', p_trigger_tag: null, p_mood_before: null, p_mood_after: null,
    p_craving: null, p_context_tag: null, p_notes: null, p_client_op_id: `op_${id}`,
  });
  return { data: data ? { id: (data as { id: string }).id } : null, error };
}

describeIfEnv('RLS cross-user isolation (integration)', () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let clientAnon: SupabaseClient;
  let userAId: string;

  beforeAll(async () => {
    const supabaseUrl = process.env.E2E_SUPABASE_URL!;
    const anonKey = process.env.E2E_SUPABASE_ANON_KEY!;

    clientA = createClient(supabaseUrl, anonKey);
    clientB = createClient(supabaseUrl, anonKey);
    clientAnon = createClient(supabaseUrl, anonKey); // never signed in

    const signInA = await clientA.auth.signInWithPassword({
      email: process.env.E2E_USER_A_EMAIL!,
      password: process.env.E2E_USER_A_PASSWORD!,
    });
    expect(signInA.error).toBeNull();

    const signInB = await clientB.auth.signInWithPassword({
      email: process.env.E2E_USER_B_EMAIL!,
      password: process.env.E2E_USER_B_PASSWORD!,
    });
    expect(signInB.error).toBeNull();

    const userResult = await clientA.auth.getUser();
    expect(userResult.error).toBeNull();
    expect(userResult.data.user).toBeTruthy();
    userAId = userResult.data.user!.id;
  });

  afterAll(async () => {
    // Best-effort orphan cleanup: if any it() block crashes mid-flight before
    // its inline cleanup runs, these deletes ensure the CI project stays
    // self-healing across runs.
    //
    // Scope is intentionally narrow:
    //   cigarette_logs — only rows whose id starts with 'log_rls_' (the prefix
    //     every probe row in this file uses; real user rows never use it).
    //   error_events   — only rows owned by userAId with category starting with
    //     'test.' (the convention used by probe inserts in this file).
    //     The 'compliance.delete' category is excluded because those rows are
    //     inserted by the service role only and are not visible through RLS
    //     anyway (SELECT returns 0 rows for authenticated users).
    if (userAId) {
      await clientA
        .from('cigarette_logs')
        .delete()
        .like('id', 'log_rls_%')
        .eq('user_id', userAId);

      await clientA
        .from('error_events')
        .delete()
        .eq('user_id', userAId)
        .like('category', 'test.%');
    }

    await clientA.auth.signOut();
    await clientB.auth.signOut();
  });

  it('prevents one user from reading/deleting another user log', async () => {
    const id = `log_rls_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const nowIso = now.toISOString();
    const localDate = nowIso.slice(0, 10);
    const localHour = now.getUTCHours();

    const insert = await insertLogViaRpc(clientA, id, nowIso, localDate, localHour);

    expect(insert.error).toBeNull();
    expect(insert.data?.id).toBe(id);

    const selectByOtherUser = await clientB
      .from('cigarette_logs')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    expect(selectByOtherUser.error).toBeNull();
    expect(selectByOtherUser.data).toBeNull();

    const deleteByOtherUser = await clientB.from('cigarette_logs').delete().eq('id', id);
    expect(deleteByOtherUser.error).toBeNull();

    const stillExists = await clientA.from('cigarette_logs').select('id').eq('id', id).maybeSingle();
    expect(stillExists.error).toBeNull();
    expect(stillExists.data?.id).toBe(id);

    const cleanup = await clientA.from('cigarette_logs').delete().eq('id', id);
    expect(cleanup.error).toBeNull();
  });

  it('denies a direct INSERT into cigarette_logs (only the rate-limited RPC writes logs)', async () => {
    const nowIso = new Date().toISOString();
    const { error } = await clientA.from('cigarette_logs').insert({
      id: `log_rls_direct_${Date.now()}`,
      user_id: userAId,
      ts_utc: nowIso,
      local_date: nowIso.slice(0, 10),
      local_hour: new Date().getUTCHours(),
      quantity: 1,
      purchase_mode: 'single',
      price_source: 'unknown',
    });
    expect(error?.code).toBe('42501');
  });

  it('lets a user edit a log but not rewrite created_at (the rate-limit window)', async () => {
    const id = `log_rls_window_${Date.now()}`;
    const now = new Date();
    const nowIso = now.toISOString();
    const insert = await insertLogViaRpc(clientA, id, nowIso, nowIso.slice(0, 10), now.getUTCHours());
    expect(insert.error).toBeNull();

    const edit = await clientA.from('cigarette_logs').update({ notes: 'edited' }).eq('id', id);
    expect(edit.error).toBeNull();

    const rewind = await clientA
      .from('cigarette_logs')
      .update({ created_at: '2000-01-01T00:00:00Z' })
      .eq('id', id);
    expect(rewind.error?.code).toBe('42501');

    const cleanup = await clientA.from('cigarette_logs').delete().eq('id', id);
    expect(cleanup.error).toBeNull();
  });

  it('prevents user B from calling record_audit_event RPC after revoke', async () => {
    const { error } = await clientB.rpc('record_audit_event', {
      p_event_type: 'consent_accepted',
      p_event_category: 'compliance',
      p_props: {},
    });
    expect(error).toBeTruthy();
    expect(
      error?.code === '42501' ||
        error?.message?.toLowerCase().includes('permission') ||
        error?.message?.toLowerCase().includes('denied'),
    ).toBe(true);
  });

  it('allows user A to select own audit_events', async () => {
    const { data, error } = await clientA
      .from('audit_events')
      .select('id, event_type')
      .limit(5);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('allows user A to insert own error_events', async () => {
    const { error } = await clientA.from('error_events').insert({
      user_id: userAId,
      category: 'test.client',
      message: 'integration probe',
    });
    expect(error).toBeNull();
  });

  // ── H1: compliance.delete tamper-resistance ────────────────────────────────

  it('H1: blocks authenticated INSERT with user_id=NULL and category=compliance.delete', async () => {
    // Authenticated users must not be able to insert null-user compliance rows;
    // only service-role (edge functions) may do so.
    const { error } = await clientA.from('error_events').insert({
      user_id: null,
      category: 'compliance.delete',
      message: 'tamper attempt',
    });
    expect(error).toBeTruthy();
  });

  it('H1: blocks authenticated INSERT with user_id=auth.uid() and category=compliance.delete', async () => {
    // The CHECK constraint (category = compliance.delete IMPLIES user_id IS NULL)
    // prevents user-owned compliance.delete rows.  Even if RLS INSERT check were
    // relaxed, the DB-level constraint fires second.
    const { error } = await clientA.from('error_events').insert({
      user_id: userAId,
      category: 'compliance.delete',
      message: 'tamper attempt via check constraint',
    });
    expect(error).toBeTruthy();
  });

  it('H1: SELECT returns zero compliance.delete rows for authenticated user', async () => {
    // Rows with user_id = NULL are not visible through the RLS SELECT policy
    // (which requires user_id = auth.uid()).
    const { data, error } = await clientA
      .from('error_events')
      .select('id')
      .eq('category', 'compliance.delete');
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('H1: authenticated DELETE on error_events affects 0 rows (RLS default-deny)', async () => {
    // No DELETE policy is defined for authenticated role, so RLS denies silently
    // (Supabase/PostgREST returns success with count 0, not an error).
    // Insert a probe row first so there is something to try to delete.
    await clientA.from('error_events').insert({
      user_id: userAId,
      category: 'test.delete.probe',
      message: 'rls delete probe',
    });

    const { error, count } = await clientA
      .from('error_events')
      .delete({ count: 'exact' })
      .eq('category', 'test.delete.probe');
    expect(error).toBeNull();
    // RLS default-deny means 0 rows matched / deleted for authenticated role.
    expect(count).toBe(0);
  });

  // ── F1a: get_daily_summary RPC ─────────────────────────────────────────────

  it('F1a: get_daily_summary returns rows in DESC date order for the calling user', async () => {
    // Use a narrow recent range so the assertion is bounded regardless of how
    // much real data exists in the test user's account. The view aggregates
    // cigarette_logs, so even an empty user returns an empty array (not an error).
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data, error } = await clientA.rpc('get_daily_summary', {
      p_from: sevenDaysAgo,
      p_to: today,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    if (Array.isArray(data) && data.length > 1) {
      // DESC means [0] is the newest. Confirm monotonic non-increasing.
      for (let i = 1; i < data.length; i++) {
        expect(String(data[i - 1].local_date) >= String(data[i].local_date)).toBe(true);
      }
    }
  });

  it('F1a: get_daily_summary rejects range > 366 days', async () => {
    // 400 days back from today — exceeds the 366-day cap baked into the RPC.
    const today = new Date().toISOString().slice(0, 10);
    const fourHundredDaysAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { error } = await clientA.rpc('get_daily_summary', {
      p_from: fourHundredDaysAgo,
      p_to: today,
    });
    expect(error).toBeTruthy();
    expect(error?.message?.toLowerCase()).toMatch(/366|range/);
  });

  it('F1a: get_daily_summary rejects p_to < p_from', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { error } = await clientA.rpc('get_daily_summary', {
      p_from: tomorrow,
      p_to: today,
    });
    expect(error).toBeTruthy();
  });

  it('F1a: v_daily_summary_user view respects RLS — user B cannot see user A rows', async () => {
    // The view is SECURITY INVOKER and the underlying cigarette_logs has RLS
    // requiring user_id = auth.uid(). User B querying the view directly should
    // never see user A's rows. We insert a probe log as A and confirm B sees
    // zero rows for that local_date in the view.
    const today = new Date().toISOString().slice(0, 10);
    const probeId = `log_f1a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();
    const localHour = new Date().getUTCHours();

    const insertA = await insertLogViaRpc(clientA, probeId, nowIso, today, localHour);
    expect(insertA.error).toBeNull();

    try {
      // B selecting the view directly with A's user_id filter must return [].
      const { data, error } = await clientB
        .from('v_daily_summary_user')
        .select('user_id, local_date, sticks')
        .eq('user_id', userAId)
        .eq('local_date', today);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    } finally {
      await clientA.from('cigarette_logs').delete().eq('id', probeId);
    }
  });

  // ── Phase C: cross-user isolation for brands / brand_variants / goals ───────

  it('C: prevents one user from reading/deleting another user brand', async () => {
    const id = `brand_rls_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();
    const insert = await clientA
      .from('brands')
      .insert({ id, user_id: userAId, name: 'RLS Probe Brand', created_at: nowIso, updated_at: nowIso })
      .select('id')
      .single();
    expect(insert.error).toBeNull();

    try {
      const byB = await clientB.from('brands').select('id').eq('id', id).maybeSingle();
      expect(byB.error).toBeNull();
      expect(byB.data).toBeNull();

      await clientB.from('brands').delete().eq('id', id);
      const still = await clientA.from('brands').select('id').eq('id', id).maybeSingle();
      expect(still.data?.id).toBe(id);
    } finally {
      await clientA.from('brands').delete().eq('id', id);
    }
  });

  it('C: user B cannot read user A brand_variants', async () => {
    const aOwn = await clientA.from('brand_variants').select('id').eq('user_id', userAId).limit(1);
    expect(aOwn.error).toBeNull();
    const bOnA = await clientB.from('brand_variants').select('id').eq('user_id', userAId);
    expect(bOnA.error).toBeNull();
    expect(bOnA.data).toHaveLength(0);
  });

  it('C: prevents one user from reading another user goal', async () => {
    const id = `goal_rls_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();
    const insert = await clientA
      .from('goals')
      .insert({
        id,
        user_id: userAId,
        type: 'daily_cap',
        target_value: 5,
        start_date: nowIso.slice(0, 10),
        created_at: nowIso,
      })
      .select('id')
      .single();
    expect(insert.error).toBeNull();

    try {
      const byB = await clientB.from('goals').select('id').eq('id', id).maybeSingle();
      expect(byB.error).toBeNull();
      expect(byB.data).toBeNull();
    } finally {
      await clientA.from('goals').delete().eq('id', id);
    }
  });

  it('C: user B cannot insert a goal owned by user A (RLS WITH CHECK)', async () => {
    const nowIso = new Date().toISOString();
    const { error } = await clientB.from('goals').insert({
      id: `goal_rls_x_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      user_id: userAId,
      type: 'daily_cap',
      target_value: 5,
      start_date: nowIso.slice(0, 10),
      created_at: nowIso,
    });
    expect(error).toBeTruthy();
  });

  // ── Phase C: anonymous (signed-out) access is denied ────────────────────────

  it('C: anonymous client cannot call the get_daily_summary SECURITY DEFINER RPC', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await clientAnon.rpc('get_daily_summary', { p_from: today, p_to: today });
    expect(error).toBeTruthy(); // RPC raises 'not authenticated' when auth.uid() is null
  });

  it('C: anonymous client reads zero rows from RLS-protected tables', async () => {
    for (const table of ['cigarette_logs', 'goals', 'brands', 'user_profiles']) {
      const { data, error } = await clientAnon.from(table).select('id').limit(1);
      // RLS with no anon policy yields an empty set (or an error) — never another
      // user's data.
      expect(Boolean(error) || (data ?? []).length === 0).toBe(true);
    }
  });
});
