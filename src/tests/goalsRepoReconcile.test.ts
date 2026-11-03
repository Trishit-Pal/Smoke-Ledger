import { completeGoalIfActive, markGoalMet } from '@/db/repositories/goals';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

import { getSupabase } from '@/lib/supabase';

interface Call {
  op: 'select' | 'update';
  payload?: unknown;
  eqs: Array<[string, unknown]>;
}

/** Records each query; `reads` answer maybeSingle(), `writes` answer an awaited update. */
function fakeClient(reads: unknown[], writes: unknown[]) {
  const calls: Call[] = [];
  const from = jest.fn(() => {
    const call: Call = { op: 'select', eqs: [] };
    calls.push(call);
    const b: Record<string, unknown> = {
      select: () => b,
      update: (payload: unknown) => {
        call.op = 'update';
        call.payload = payload;
        return b;
      },
      eq: (col: string, val: unknown) => {
        call.eqs.push([col, val]);
        return b;
      },
      maybeSingle: () => Promise.resolve(reads.shift()),
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
        Promise.resolve(writes.shift()).then(ok, bad),
    };
    return b;
  });
  (getSupabase as jest.Mock).mockReturnValue({
    from,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  });
  return calls;
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'g1',
  user_id: 'u1',
  type: 'daily_cap',
  target_value: 5,
  current_baseline: null,
  start_date: '2025-01-01',
  end_date: null,
  status: 'active',
  meta_json: null,
  created_at: '2025-01-01T00:00:00.000Z',
  completed_at: null,
  ...over,
});

describe('completeGoalIfActive', () => {
  it('only touches an active goal and reports whether a row changed', async () => {
    const calls = fakeClient([], [{ data: [{ id: 'g1' }], error: null }]);
    await expect(completeGoalIfActive('gol_1')).resolves.toBe(true);
    expect(calls[0].payload).toEqual({ status: 'completed' });
    expect(calls[0].eqs).toContainEqual(['status', 'active']);
  });

  it('is not applied when the goal was set aside or deleted elsewhere (0 rows)', async () => {
    fakeClient([], [{ data: [], error: null }]);
    await expect(completeGoalIfActive('gol_1')).resolves.toBe(false);
  });

  it('throws a real database error', async () => {
    fakeClient([], [{ data: null, error: { message: 'boom' } }]);
    await expect(completeGoalIfActive('gol_1')).rejects.toThrow();
  });
});

describe('markGoalMet', () => {
  it('merges metOn onto the CURRENT meta, keeping a step written since the snapshot', async () => {
    const current = { steps: [{ cap: 4, from: '2025-05-30', reason: 'next' }], dismissals: { next: '2025-05-29' } };
    const calls = fakeClient(
      [{ data: row({ target_value: 5, meta_json: current }), error: null }],
      [{ data: [{ id: 'g1' }], error: null }],
    );
    await expect(markGoalMet('gol_1', '2025-05-31', 5)).resolves.toBe(true);
    expect(calls[1].payload).toEqual({ meta_json: { ...current, metOn: '2025-05-31' } });
    // The write is conditional on what the plan saw, so an accept that lands in between wins.
    expect(calls[1].eqs).toEqual(expect.arrayContaining([['status', 'active'], ['target_value', 5]]));
  });

  it('is not applied when the target changed since the plan (a step was accepted meanwhile)', async () => {
    const calls = fakeClient([{ data: row({ target_value: 4 }), error: null }], []);
    await expect(markGoalMet('gol_1', '2025-05-31', 5)).resolves.toBe(false);
    expect(calls).toHaveLength(1); // no write issued
  });

  it('is not applied when the goal is gone or no longer active', async () => {
    fakeClient([{ data: null, error: null }], []);
    await expect(markGoalMet('gol_1', '2025-05-31', 5)).resolves.toBe(false);
  });

  it('is not applied when the guarded write matches 0 rows (lost the race)', async () => {
    fakeClient([{ data: row(), error: null }], [{ data: [], error: null }]);
    await expect(markGoalMet('gol_1', '2025-05-31', 5)).resolves.toBe(false);
  });
});
