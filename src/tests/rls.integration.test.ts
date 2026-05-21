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

describeIfEnv('RLS cross-user isolation (integration)', () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let userAId: string;

  beforeAll(async () => {
    const supabaseUrl = process.env.E2E_SUPABASE_URL!;
    const anonKey = process.env.E2E_SUPABASE_ANON_KEY!;

    clientA = createClient(supabaseUrl, anonKey);
    clientB = createClient(supabaseUrl, anonKey);

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
    await clientA.auth.signOut();
    await clientB.auth.signOut();
  });

  it('prevents one user from reading/deleting another user log', async () => {
    const id = `log_rls_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const nowIso = now.toISOString();
    const localDate = nowIso.slice(0, 10);
    const localHour = now.getUTCHours();

    const insert = await clientA
      .from('cigarette_logs')
      .insert({
        id,
        user_id: userAId,
        ts_utc: nowIso,
        local_date: localDate,
        local_hour: localHour,
        quantity: 1,
        purchase_mode: 'single',
        price_source: 'unknown',
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id')
      .single();

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
});
