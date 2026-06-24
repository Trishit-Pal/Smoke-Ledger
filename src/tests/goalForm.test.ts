import {
  GOAL_TYPE_META,
  emptyGoalForm,
  goalToFormState,
  deriveReductionBaseline,
  buildGoalPayload,
  buildGoalPatch,
  type GoalFormState,
} from '@/domain/goalForm';
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
  it('covers all six goal types once', () => {
    const types = GOAL_TYPE_META.map((m) => m.type).sort();
    expect(types).toEqual(
      ['daily_cap', 'no_smoke_window', 'quit_date', 'reduction_target', 'spend_cap_daily', 'weekly_target'].sort(),
    );
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
    for (const type of ['daily_cap', 'weekly_target', 'spend_cap_daily'] as const) {
      const r = buildGoalPayload(form({ type, target: '5' }), [], TODAY);
      expect(r).toEqual({ ok: true, payload: { type, targetValue: 5 } });
    }
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
    expect(r).toEqual({ ok: true, patch: { targetValue: 250 } });
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
});
