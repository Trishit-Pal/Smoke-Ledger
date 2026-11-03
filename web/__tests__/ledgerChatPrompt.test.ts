import { describe, expect, test } from 'vitest';
import { buildToolContext } from '@/domain/ledgerChat/context';
import type { CigaretteLog, Goal, UserProfile } from '@/types';
import { userContextBlock } from '@web/lib/server/ledgerChat/prompt';

const TODAY = '2026-06-21';

const profile: UserProfile = {
  baselinePerDay: 10,
  baselineWindowDays: 7,
  currency: 'INR',
  discreetMode: false,
  appLockEnabled: false,
  hideTotalsOnHome: false,
  onboardedAt: '2026-01-01T00:00:00.000Z',
  country: null,
};

const goal: Goal = {
  id: 'g1',
  type: 'daily_cap',
  targetValue: 5,
  currentBaseline: 10,
  startDate: '2026-05-01',
  endDate: null,
  status: 'active',
  meta: null,
  createdAt: '',
  completedAt: null,
};

function dayShift(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function logsOf(perDay: number): CigaretteLog[] {
  return Array.from({ length: 30 }, (_, i) => ({
    id: `l${i}`,
    tsUtc: '',
    localDate: dayShift(TODAY, -i),
    localHour: 9,
    brandId: 'b1',
    brandNameSnap: 'Gold Flake',
    variantSnap: 'Kings',
    quantity: perDay,
    purchaseMode: 'single',
    packSize: null,
    totalPriceInr: 20,
    unitPriceInr: 20,
    priceSource: 'exact',
    triggerTag: null,
    moodBefore: null,
    moodAfter: null,
    craving: null,
    contextTag: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
  })) as CigaretteLog[];
}

function goalsLine(g: Goal, logs: CigaretteLog[]): string {
  const ctx = buildToolContext({ profile, logs, rows: [], goals: [g], today: TODAY, summarySinceYmd: '2025-06-22' });
  return userContextBlock(ctx)
    .split('\n')
    .find((l) => l.startsWith('- Active goals'))!;
}

describe('userContextBlock goal line', () => {
  test('lists state and a next-step note for a met goal with a suggestion, with no figures', () => {
    const line = goalsLine({ ...goal, meta: { metOn: dayShift(TODAY, -10) } }, logsOf(1));
    expect(line).toBe('- Active goals: daily cap (met, next step suggested)');
  });

  test('says re-anchor for an off-track goal with a suggestion', () => {
    expect(goalsLine(goal, logsOf(9))).toBe('- Active goals: daily cap (off track, re-anchor suggested)');
  });

  test('state alone when nothing is suggested', () => {
    expect(goalsLine(goal, [])).toBe('- Active goals: daily cap (on track)');
  });
});
