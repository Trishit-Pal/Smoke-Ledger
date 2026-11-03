import {
  GOAL_TYPE_META,
  emptyGoalForm,
  goalToFormState,
  deriveReductionBaseline,
  buildGoalPayload,
  buildGoalPatch,
  blockingSameTypeGoal,
  creatableGoalTypes,
  goalTypeLabel,
  acceptProposalPatch,
  dismissProposalPatch,
  proposalToForm,
  capSeries,
  type GoalFormState,
} from '@/domain/goalForm';
import type { Proposal } from '@/domain/goalProposals';
import { daysUntil } from '@/lib/date';
import type { CigaretteLog, Goal } from '@/types';

function mkLog(overrides: Partial<CigaretteLog>): CigaretteLog {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    tsUtc: overrides.tsUtc ?? '2025-03-01T10:00:00.000Z',
    localDate: overrides.localDate ?? '2025-03-01',
    localHour: overrides.localHour ?? 15,
    brandId: overrides.brandId ?? 'b1',
    brandNameSnap: overrides.brandNameSnap ?? 'Gold Flake',
    variantSnap: overrides.variantSnap ?? 'Kings',
    quantity: overrides.quantity ?? 1,
    purchaseMode: overrides.purchaseMode ?? 'single',
    packSize: overrides.packSize ?? null,
    totalPriceInr: overrides.totalPriceInr ?? 20,
    unitPriceInr: overrides.unitPriceInr ?? 20,
    priceSource: overrides.priceSource ?? 'exact',
    triggerTag: overrides.triggerTag ?? null,
    moodBefore: overrides.moodBefore ?? null,
    moodAfter: overrides.moodAfter ?? null,
    craving: overrides.craving ?? null,
    contextTag: overrides.contextTag ?? null,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? '2025-03-01T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2025-03-01T10:00:00.000Z',
  };
}

const TODAY = '2025-03-30';

function form(overrides: Partial<GoalFormState>): GoalFormState {
  return { ...emptyGoalForm(), ...overrides };
}

describe('daysUntil', () => {
  it('is positive for a future date', () => {
    expect(daysUntil('2025-03-30', '2025-04-05')).toBe(6);
  });
  it('is zero for the same day', () => {
    expect(daysUntil('2025-03-30', '2025-03-30')).toBe(0);
  });
  it('is negative for a past date (no Math.abs)', () => {
    expect(daysUntil('2025-03-30', '2025-03-25')).toBe(-5);
  });
});

describe('GOAL_TYPE_META', () => {
  it('covers all seven goal types once', () => {
    const types = GOAL_TYPE_META.map((m) => m.type).sort();
    expect(types).toEqual(
      ['daily_cap', 'no_smoke_window', 'quit_date', 'reduction_target', 'spend_cap_daily', 'taper', 'weekly_target'].sort(),
    );
  });

  it('orders the picker daily_cap, taper, quit_date, spend, weekly, window, reduction', () => {
    expect(GOAL_TYPE_META.map((m) => m.type)).toEqual([
      'daily_cap', 'taper', 'quit_date', 'spend_cap_daily', 'weekly_target', 'no_smoke_window', 'reduction_target',
    ]);
  });

  it('creatableGoalTypes excludes reduction_target only', () => {
    const types = creatableGoalTypes().map((m) => m.type);
    expect(types).not.toContain('reduction_target');
    expect(types).toHaveLength(6);
  });

  it('labels taper and spend with the new copy', () => {
    expect(goalTypeLabel('taper')).toBe('Taper');
    expect(goalTypeLabel('spend_cap_daily')).toBe('Spend cap');
  });
});

describe('deriveReductionBaseline', () => {
  it('is 0 with no logs', () => {
    expect(deriveReductionBaseline([], TODAY)).toBe(0);
  });
  it('rounds the 30-day rolling average to one decimal', () => {
    // 30 sticks within the trailing 30-day window → 30/30 = 1.0/day.
    const logs = [mkLog({ localDate: TODAY, quantity: 30 })];
    expect(deriveReductionBaseline(logs, TODAY)).toBe(1);
  });
});

describe('buildGoalPayload', () => {
  it('maps scalar-cap types to a targetValue', () => {
    for (const type of ['daily_cap', 'weekly_target'] as const) {
      const r = buildGoalPayload(form({ type, target: '5' }), [], TODAY);
      expect(r).toEqual({ ok: true, payload: { type, targetValue: 5 } });
    }
  });

  it('spend cap payload carries the period', () => {
    const r = buildGoalPayload(form({ type: 'spend_cap_daily', target: '500', period: 'week' }), [], TODAY);
    expect(r).toEqual({ ok: true, payload: { type: 'spend_cap_daily', targetValue: 500, meta: { period: 'week' } } });
  });

  it('taper payload seeds a start step and a derived baseline', () => {
    const logs = [mkLog({ localDate: TODAY, quantity: 30 })]; // baseline 1.0
    const r = buildGoalPayload(form({ type: 'taper', target: '8', finalTarget: '2' }), logs, TODAY);
    expect(r).toEqual({
      ok: true,
      payload: {
        type: 'taper',
        targetValue: 8,
        currentBaseline: 1,
        meta: { finalTarget: 2, steps: [{ cap: 8, from: TODAY, reason: 'start' }] },
      },
    });
  });

  it('taper payload has a null baseline when none can be derived', () => {
    const r = buildGoalPayload(form({ type: 'taper', target: '8', finalTarget: '2' }), [], TODAY);
    expect(r.ok && r.payload.currentBaseline).toBeNull();
  });

  it('taper rejects a bad start cap, final target, or final not below start', () => {
    expect(buildGoalPayload(form({ type: 'taper', target: '0', finalTarget: '2' }), [], TODAY)).toEqual({
      ok: false, error: 'Enter a starting cap greater than 0.',
    });
    expect(buildGoalPayload(form({ type: 'taper', target: '8', finalTarget: '' }), [], TODAY)).toEqual({
      ok: false, error: 'Enter a final target greater than 0.',
    });
    expect(buildGoalPayload(form({ type: 'taper', target: '8', finalTarget: '8' }), [], TODAY)).toEqual({
      ok: false, error: 'The final target should be below the starting cap.',
    });
  });

  it('rejects a non-positive scalar target', () => {
    expect(buildGoalPayload(form({ type: 'daily_cap', target: '0' }), [], TODAY).ok).toBe(false);
    expect(buildGoalPayload(form({ type: 'daily_cap', target: 'abc' }), [], TODAY).ok).toBe(false);
  });

  it('reduction_target uses a typed baseline and requires target below it', () => {
    const ok = buildGoalPayload(form({ type: 'reduction_target', target: '3', baseline: '8' }), [], TODAY);
    expect(ok).toEqual({ ok: true, payload: { type: 'reduction_target', targetValue: 3, currentBaseline: 8 } });
    const bad = buildGoalPayload(form({ type: 'reduction_target', target: '8', baseline: '8' }), [], TODAY);
    expect(bad.ok).toBe(false);
  });

  it('reduction_target derives the baseline from logs when blank', () => {
    const logs = [mkLog({ localDate: TODAY, quantity: 30 })]; // → baseline 1.0
    const r = buildGoalPayload(form({ type: 'reduction_target', target: '0.5', baseline: '' }), logs, TODAY);
    expect(r).toEqual({ ok: true, payload: { type: 'reduction_target', targetValue: 0.5, currentBaseline: 1 } });
  });

  it('reduction_target fails when no baseline can be derived', () => {
    const r = buildGoalPayload(form({ type: 'reduction_target', target: '3', baseline: '' }), [], TODAY);
    expect(r.ok).toBe(false);
  });

  it('no_smoke_window stores hours in meta with an inert targetValue of 1', () => {
    const r = buildGoalPayload(form({ type: 'no_smoke_window', startHour: 22, endHour: 6 }), [], TODAY);
    expect(r).toEqual({
      ok: true,
      payload: { type: 'no_smoke_window', targetValue: 1, meta: { startHour: 22, endHour: 6 } },
    });
  });

  it('no_smoke_window rejects equal start/end hours', () => {
    expect(buildGoalPayload(form({ type: 'no_smoke_window', startHour: 8, endHour: 8 }), [], TODAY).ok).toBe(false);
  });

  it('quit_date computes days-until and stores endDate', () => {
    const logs = [mkLog({ localDate: TODAY, quantity: 30 })]; // baseline 1.0
    const r = buildGoalPayload(form({ type: 'quit_date', quitDate: '2025-04-06', baseline: '' }), logs, TODAY);
    expect(r).toEqual({
      ok: true,
      payload: { type: 'quit_date', targetValue: 7, endDate: '2025-04-06', currentBaseline: 1 },
    });
  });

  it('quit_date rejects a past or same-day date', () => {
    expect(buildGoalPayload(form({ type: 'quit_date', quitDate: TODAY }), [], TODAY).ok).toBe(false);
    expect(buildGoalPayload(form({ type: 'quit_date', quitDate: '2025-03-01' }), [], TODAY).ok).toBe(false);
  });

  it('quit_date allows a null baseline when none can be derived', () => {
    const r = buildGoalPayload(form({ type: 'quit_date', quitDate: '2025-04-06', baseline: '' }), [], TODAY);
    expect(r).toEqual({
      ok: true,
      payload: { type: 'quit_date', targetValue: 7, endDate: '2025-04-06', currentBaseline: null },
    });
  });
});

function mkGoal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.id ?? 'gol_1',
    type: overrides.type ?? 'daily_cap',
    targetValue: overrides.targetValue ?? 5,
    currentBaseline: overrides.currentBaseline ?? null,
    startDate: overrides.startDate ?? '2025-03-01',
    endDate: overrides.endDate ?? null,
    status: overrides.status ?? 'active',
    meta: overrides.meta ?? null,
    createdAt: overrides.createdAt ?? '2025-03-01T00:00:00.000Z',
    completedAt: overrides.completedAt ?? null,
  };
}

describe('goalToFormState (edit prefill round-trip)', () => {
  it('round-trips a daily_cap through buildGoalPatch', () => {
    const goal = mkGoal({ type: 'daily_cap', targetValue: 4 });
    const r = buildGoalPatch(goalToFormState(goal), [], TODAY);
    expect(r).toEqual({ ok: true, patch: { targetValue: 4 } });
  });

  it('round-trips a spend_cap_daily', () => {
    const goal = mkGoal({ type: 'spend_cap_daily', targetValue: 250 });
    const r = buildGoalPatch(goalToFormState(goal), [], TODAY);
    expect(r).toEqual({ ok: true, patch: { targetValue: 250, meta: { period: 'day' } } });
  });

  it('round-trips a reduction_target keeping target below baseline', () => {
    const goal = mkGoal({ type: 'reduction_target', targetValue: 3, currentBaseline: 8 });
    const form = goalToFormState(goal);
    expect(form.target).toBe('3');
    expect(form.baseline).toBe('8');
    const r = buildGoalPatch(form, [], TODAY);
    expect(r).toEqual({ ok: true, patch: { targetValue: 3, currentBaseline: 8 } });
  });

  it('round-trips a no_smoke_window from meta hours (blank scalar target)', () => {
    const goal = mkGoal({ type: 'no_smoke_window', targetValue: 1, meta: { startHour: 21, endHour: 5 } });
    const form = goalToFormState(goal);
    expect(form.target).toBe('');
    expect(form.startHour).toBe(21);
    expect(form.endHour).toBe(5);
    const r = buildGoalPatch(form, [], TODAY);
    expect(r).toEqual({
      ok: true,
      patch: { targetValue: 1, meta: { startHour: 21, endHour: 5 } },
    });
  });

  it('round-trips a quit_date (blank scalar target, recomputed days from endDate)', () => {
    const goal = mkGoal({ type: 'quit_date', targetValue: 99, endDate: '2025-04-06', currentBaseline: 2 });
    const form = goalToFormState(goal);
    expect(form.target).toBe('');
    expect(form.quitDate).toBe('2025-04-06');
    expect(form.baseline).toBe('2');
    const r = buildGoalPatch(form, [], TODAY);
    // targetValue recomputed from the date, not the stale stored 99.
    expect(r).toEqual({ ok: true, patch: { targetValue: 7, endDate: '2025-04-06', currentBaseline: 2 } });
  });

  it('falls back to default hours when meta is missing', () => {
    const goal = mkGoal({ type: 'no_smoke_window', targetValue: 1, meta: null });
    const form = goalToFormState(goal);
    expect(form.startHour).toBe(22);
    expect(form.endHour).toBe(6);
  });
});

describe('buildGoalPatch', () => {
  it('drops type/startDate and keeps editable fields', () => {
    const r = buildGoalPatch(form({ type: 'daily_cap', target: '4' }), [], TODAY);
    expect(r).toEqual({ ok: true, patch: { targetValue: 4 } });
  });

  it('keeps endDate + recomputed targetValue for quit_date edits', () => {
    const r = buildGoalPatch(form({ type: 'quit_date', quitDate: '2025-04-06', baseline: '2' }), [], TODAY);
    expect(r).toEqual({ ok: true, patch: { targetValue: 7, endDate: '2025-04-06', currentBaseline: 2 } });
  });

  it('propagates validation failures', () => {
    expect(buildGoalPatch(form({ type: 'daily_cap', target: '-1' }), [], TODAY).ok).toBe(false);
  });

  it('editing a daily cap seeds the start step, appends an edit step, and clears metOn', () => {
    const goal = mkGoal({ type: 'daily_cap', targetValue: 5, meta: { metOn: '2025-03-20' } });
    const r = buildGoalPatch(form({ type: 'daily_cap', target: '4' }), [], TODAY, goal);
    expect(r).toEqual({
      ok: true,
      patch: {
        targetValue: 4,
        meta: {
          steps: [
            { cap: 5, from: '2025-03-01', reason: 'start' },
            { cap: 4, from: TODAY, reason: 'edit' },
          ],
        },
      },
    });
    expect(r.ok && r.patch.meta).not.toHaveProperty('metOn');
  });

  it('editing without changing the target leaves steps and metOn alone', () => {
    const goal = mkGoal({ type: 'daily_cap', targetValue: 5, meta: { metOn: '2025-03-20' } });
    const r = buildGoalPatch(form({ type: 'daily_cap', target: '5' }), [], TODAY, goal);
    expect(r).toEqual({ ok: true, patch: { targetValue: 5, meta: { metOn: '2025-03-20' } } });
  });

  it('editing preserves unrelated meta such as dismissals', () => {
    const goal = mkGoal({ type: 'daily_cap', targetValue: 5, meta: { dismissals: { next: '2025-03-10' } } });
    const r = buildGoalPatch(form({ type: 'daily_cap', target: '4' }), [], TODAY, goal);
    expect(r.ok && r.patch.meta).toMatchObject({ dismissals: { next: '2025-03-10' } });
  });

  it('editing a weekly target never writes steps', () => {
    const goal = mkGoal({ type: 'weekly_target', targetValue: 30 });
    const r = buildGoalPatch(form({ type: 'weekly_target', target: '25' }), [], TODAY, goal);
    expect(r).toEqual({ ok: true, patch: { targetValue: 25 } });
  });

  it('editing a spend cap round-trips the period and steps only for a daily period', () => {
    const week = mkGoal({ type: 'spend_cap_daily', targetValue: 500, meta: { period: 'week' } });
    const rw = buildGoalPatch(goalToFormState(week), [], TODAY, week);
    expect(rw).toEqual({ ok: true, patch: { targetValue: 500, meta: { period: 'week' } } });

    const day = mkGoal({ type: 'spend_cap_daily', targetValue: 100 });
    const rd = buildGoalPatch(form({ type: 'spend_cap_daily', target: '80', period: 'day' }), [], TODAY, day);
    expect(rd.ok && rd.patch.meta).toMatchObject({ period: 'day', steps: [{ cap: 100 }, { cap: 80, reason: 'edit' }] });
  });

  it('editing a taper keeps its steps (no fresh start step) and appends an edit step', () => {
    const steps = [
      { cap: 8, from: '2025-03-01', reason: 'start' },
      { cap: 6, from: '2025-03-15', reason: 'next' },
    ];
    const goal = mkGoal({ type: 'taper', targetValue: 6, currentBaseline: 9, meta: { finalTarget: 2, steps } });
    const r = buildGoalPatch(goalToFormState(goal), [], TODAY, goal);
    expect(r).toEqual({ ok: true, patch: { targetValue: 6, meta: { finalTarget: 2, steps } } });

    const r2 = buildGoalPatch(form({ type: 'taper', target: '5', finalTarget: '2' }), [], TODAY, goal);
    expect(r2.ok && r2.patch.meta?.['steps']).toEqual([...steps, { cap: 5, from: TODAY, reason: 'edit' }]);
    expect(r2.ok && r2.patch).not.toHaveProperty('currentBaseline');
  });
});

describe('goalToFormState (adaptive fields)', () => {
  it('reads taper target, finalTarget and spend period', () => {
    const taper = goalToFormState(mkGoal({ type: 'taper', targetValue: 6, meta: { finalTarget: 2 } }));
    expect(taper).toMatchObject({ type: 'taper', target: '6', finalTarget: '2', period: 'day' });
    const spend = goalToFormState(mkGoal({ type: 'spend_cap_daily', targetValue: 500, meta: { period: 'month' } }));
    expect(spend).toMatchObject({ target: '500', period: 'month', finalTarget: '' });
  });

  it('emptyGoalForm defaults period and finalTarget', () => {
    expect(emptyGoalForm()).toMatchObject({ period: 'day', finalTarget: '' });
  });
});

describe('proposal patches', () => {
  const goal = mkGoal({
    type: 'daily_cap',
    targetValue: 5,
    meta: { metOn: '2025-03-25', dismissals: { reanchor: '2025-03-01' } },
  });
  const next: Proposal = { kind: 'next', type: 'daily_cap', value: 4, unit: 'sticks', basisAvg: 3, heldDays: 14 };

  it('accepting a next step sets the target, appends a step, and removes metOn', () => {
    const patch = acceptProposalPatch(goal, next, TODAY);
    expect(patch).toEqual({
      targetValue: 4,
      meta: {
        dismissals: { reanchor: '2025-03-01' },
        steps: [
          { cap: 5, from: '2025-03-01', reason: 'start' },
          { cap: 4, from: TODAY, reason: 'next' },
        ],
      },
    });
    expect(patch.meta).not.toHaveProperty('metOn');
  });

  it('accepting a reanchor records the reanchor reason', () => {
    const patch = acceptProposalPatch(goal, { ...next, kind: 'reanchor', value: 9, overDays: 5 }, TODAY);
    expect(patch.meta?.['steps']).toEqual([
      { cap: 5, from: '2025-03-01', reason: 'start' },
      { cap: 9, from: TODAY, reason: 'reanchor' },
    ]);
  });

  it('dismissing stamps today under the kind and keeps other dismissals', () => {
    expect(dismissProposalPatch(goal, 'next', TODAY)).toEqual({
      meta: { metOn: '2025-03-25', dismissals: { reanchor: '2025-03-01', next: TODAY } },
    });
  });

  it('does not mutate the goal', () => {
    const before = JSON.stringify(goal);
    acceptProposalPatch(goal, next, TODAY);
    dismissProposalPatch(goal, 'next', TODAY);
    expect(JSON.stringify(goal)).toBe(before);
  });

  it('proposalToForm maps a quit date proposal', () => {
    const p: Proposal = { kind: 'start', type: 'quit_date', value: 42, unit: 'sticks', date: '2025-05-11', basisAvg: 2 };
    expect(proposalToForm(p)).toEqual({ type: 'quit_date', target: '42', period: 'day', quitDate: '2025-05-11' });
  });

  it('proposalToForm maps a spend proposal with its period', () => {
    const p: Proposal = { kind: 'start', type: 'spend_cap_daily', value: 450, unit: 'money', period: 'week', basisAvg: 70 };
    expect(proposalToForm(p)).toEqual({ type: 'spend_cap_daily', target: '450', period: 'week', quitDate: '' });
  });
});

describe('capSeries', () => {
  it('returns the cap in force per date, null before start', () => {
    const goal = mkGoal({
      startDate: '2025-03-10',
      targetValue: 4,
      meta: { steps: [{ cap: 6, from: '2025-03-10', reason: 'start' }, { cap: 4, from: '2025-03-20', reason: 'next' }] },
    });
    expect(capSeries(goal, ['2025-03-09', '2025-03-10', '2025-03-19', '2025-03-20', '2025-03-21'])).toEqual([
      null, 6, 6, 4, 4,
    ]);
  });
});

describe('blockingSameTypeGoal (dedup rule)', () => {
  it('blocks an active same-type goal', () => {
    const goals = [mkGoal({ type: 'daily_cap', status: 'active' })];
    expect(blockingSameTypeGoal('daily_cap', goals)?.status).toBe('active');
  });

  it('blocks a paused same-type goal', () => {
    const goals = [mkGoal({ type: 'daily_cap', status: 'paused' })];
    expect(blockingSameTypeGoal('daily_cap', goals)?.status).toBe('paused');
  });

  it('allows a new goal once the prior is completed or abandoned', () => {
    const goals = [
      mkGoal({ id: 'g1', type: 'daily_cap', status: 'completed' }),
      mkGoal({ id: 'g2', type: 'daily_cap', status: 'abandoned' }),
    ];
    expect(blockingSameTypeGoal('daily_cap', goals)).toBeNull();
  });

  it('does not block a different type', () => {
    const goals = [mkGoal({ type: 'daily_cap', status: 'active' })];
    expect(blockingSameTypeGoal('spend_cap_daily', goals)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(blockingSameTypeGoal('daily_cap', [])).toBeNull();
  });
});
