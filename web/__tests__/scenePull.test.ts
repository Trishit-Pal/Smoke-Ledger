import { describe, it, expect } from 'vitest';
import { HEALTH_MILESTONES } from '@/constants/milestones';
import { formatMinutesUntil } from '@/domain/health';
import type { DailySummaryRow } from '@/domain/periodSummary';
import {
  grainDue,
  grainEligible,
  jarFill,
  milestoneLine,
  sweepDue,
  underBaselineYesterday,
  type MinimalStorage,
} from '@web/components/marketing/scene/pull';

const NOW = new Date('2026-11-04T12:00:00.000Z');
const minutesAgo = (m: number): string => new Date(NOW.getTime() - m * 60_000).toISOString();
const unperiod = (s: string): string => s.replace(/\.$/, '');

function fakeStorage(initial: Record<string, string> = {}): MinimalStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const throwing: MinimalStorage = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
};

describe('milestoneLine', () => {
  it('returns null without a last entry', () => {
    expect(milestoneLine(null, NOW)).toBeNull();
  });

  it('names the first milestone and the time left, without the body trailing period', () => {
    const line = milestoneLine(minutesAgo(10), NOW);
    expect(line).toEqual({
      text: `${unperiod(HEALTH_MILESTONES[0].body)} — in ${formatMinutesUntil(10)}`,
      caption: 'Next, from your last entry',
      milestoneMinutes: null,
    });
  });

  it('says "in" before the time left, so "10m" cannot read as ten minutes ago', () => {
    const line = milestoneLine(minutesAgo(HEALTH_MILESTONES[0].minutes - 10), NOW);
    expect(line?.text).toMatch(/ — in 10m$/);
  });

  it('turns a dash inside a body into "; " so only one " — " joins the time', () => {
    const m = HEALTH_MILESTONES.find((x) => x.minutes === 2880);
    expect(m?.body).toContain(' — '); // the 48 h body carries its own dash
    const line = milestoneLine(minutesAgo(2880 - 1054), NOW); // 17h 34m to go
    expect(line?.text).toBe('Nerve endings start regrowing; taste and smell sharpen — in 17h 34m');
    expect(line?.text.split(' — ')).toHaveLength(2);
  });

  it('applies the same body clean-up to the reached branch', () => {
    const last = HEALTH_MILESTONES[HEALTH_MILESTONES.length - 1];
    const line = milestoneLine(minutesAgo(last.minutes + 5), NOW);
    expect(line?.text.split(' — ')).toHaveLength(2);
  });

  it('reports the last milestone as reached once all are passed', () => {
    const last = HEALTH_MILESTONES[HEALTH_MILESTONES.length - 1];
    const line = milestoneLine(minutesAgo(last.minutes + 5), NOW);
    expect(line?.text).toBe(`${unperiod(last.body)} — reached`);
    expect(line?.text.endsWith(' — reached')).toBe(true);
    expect(line?.milestoneMinutes).toBe(last.minutes);
  });

  it('reports the latest reached milestone between two milestones', () => {
    const line = milestoneLine(minutesAgo(HEALTH_MILESTONES[0].minutes + 1), NOW);
    expect(line?.milestoneMinutes).toBe(HEALTH_MILESTONES[0].minutes);
    expect(line?.text.startsWith(unperiod(HEALTH_MILESTONES[1].body))).toBe(true);
  });

  it('treats a future last entry as just logged', () => {
    const future = new Date(NOW.getTime() + 3_600_000).toISOString();
    const line = milestoneLine(future, NOW);
    expect(line?.text).toBe(`${unperiod(HEALTH_MILESTONES[0].body)} — in ${formatMinutesUntil(HEALTH_MILESTONES[0].minutes)}`);
    expect(line?.milestoneMinutes).toBeNull();
  });
});

describe('sweepDue', () => {
  it('stores the first value and does not sweep', () => {
    const s = fakeStorage();
    expect(sweepDue(s, 20)).toBe(false);
    expect(s.data['scene-milestone-seen']).toBe('20');
  });

  it('sweeps once when the reached milestone changes, then updates the store', () => {
    const s = fakeStorage({ 'scene-milestone-seen': '20' });
    expect(sweepDue(s, 480)).toBe(true);
    expect(s.data['scene-milestone-seen']).toBe('480');
    expect(sweepDue(s, 480)).toBe(false);
  });

  it('never sweeps when nothing is reached, even after a reset', () => {
    const s = fakeStorage({ 'scene-milestone-seen': '480' });
    expect(sweepDue(s, null)).toBe(false);
    expect(s.data['scene-milestone-seen']).toBe('0');
  });

  it('returns false when storage throws', () => {
    expect(sweepDue(throwing, 20)).toBe(false);
  });
});

describe('jarFill', () => {
  it('is 0 at 0', () => {
    expect(jarFill(0, 10, 15)).toBe(0);
  });

  it('rises monotonically and stays below 1', () => {
    let prev = -1;
    for (const total of [0, 100, 500, 2000, 10_000]) {
      const f = jarFill(total, 10, 15);
      expect(f).toBeGreaterThan(prev);
      expect(f).toBeLessThan(1);
      prev = f;
    }
  });

  it('follows total / (total + a week of baseline spend): one week kept reads half, nine weeks 0.9', () => {
    expect(jarFill(7 * 10 * 15, 10, 15)).toBeCloseTo(0.5, 9);
    expect(jarFill(9 * 7 * 10 * 15, 10, 15)).toBeCloseTo(0.9, 9);
    expect(jarFill(1000, 10, 15)).toBeCloseTo(1000 / (1000 + 7 * 10 * 15), 9);
  });

  it('keeps creeping: three weeks of full savings is nowhere near full', () => {
    expect(jarFill(21 * 10 * 15, 10, 15)).toBeCloseTo(0.75, 9);
  });

  it('uses a per-stick price under 1 as it is (EUR readers), not as 1', () => {
    expect(jarFill(0.4 * 10 * 7, 10, 0.4)).toBeCloseTo(0.5, 9);
  });

  it('is finite when baseline and price are 0 (each floors to 1)', () => {
    expect(Number.isFinite(jarFill(500, 0, 0))).toBe(true);
    expect(jarFill(500, 0, 0)).toBeCloseTo(500 / (500 + 7), 9);
  });

  it('is finite and in [0, 1) for NaN or infinite inputs', () => {
    for (const f of [jarFill(500, Number.NaN, 15), jarFill(500, 10, Number.NaN), jarFill(500, Infinity, 15), jarFill(500, 10, Infinity), jarFill(Number.NaN, 10, 15), jarFill(Infinity, 10, 15)]) {
      expect(Number.isFinite(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('stays below 1 for very large totals', () => {
    expect(jarFill(1e12, 10, 15)).toBeLessThan(1);
    expect(jarFill(Number.MAX_VALUE, 10, 15)).toBeLessThan(1);
  });
});

describe('grainEligible', () => {
  const today = '2026-11-04';
  const yesterday = '2026-11-03';

  it('is false with no rows (brand-new reader)', () => {
    expect(grainEligible([], 10, today, '2026-10-01')).toBe(false);
  });

  it('is false on the day of onboarding: yesterday predates the ledger', () => {
    expect(grainEligible([row(today, 2)], 10, today, today)).toBe(false);
  });

  it('is true once yesterday is on or after the onboarding day and under baseline', () => {
    expect(grainEligible([row(yesterday, 3)], 10, today, yesterday)).toBe(true);
    expect(grainEligible([row(yesterday, 3)], 10, today, '2026-10-01')).toBe(true);
  });

  it('is false when yesterday was at or above baseline', () => {
    expect(grainEligible([row(yesterday, 10)], 10, today, '2026-10-01')).toBe(false);
  });
});

const row = (date: string, sticks: number): DailySummaryRow => ({ date, sticks, spendInr: 0, avgUnitPriceInr: null });

describe('underBaselineYesterday', () => {
  const today = '2026-11-04';

  it('is true when yesterday is below a positive baseline', () => {
    expect(underBaselineYesterday([row('2026-11-03', 3)], 10, today)).toBe(true);
  });

  it('is false at or above the baseline', () => {
    expect(underBaselineYesterday([row('2026-11-03', 10)], 10, today)).toBe(false);
  });

  it('is false without a positive baseline', () => {
    expect(underBaselineYesterday([row('2026-11-03', 0)], 0, today)).toBe(false);
    expect(underBaselineYesterday([row('2026-11-03', 0)], Number.NaN, today)).toBe(false);
  });

  it('counts a day with no row as smoke-free', () => {
    expect(underBaselineYesterday([], 10, today)).toBe(true);
  });

  it('ignores today and other days', () => {
    expect(underBaselineYesterday([row(today, 0), row('2026-11-02', 0), row('2026-11-03', 12)], 10, today)).toBe(false);
  });
});

describe('grainDue', () => {
  it('fires once per day per storage', () => {
    const s = fakeStorage();
    expect(grainDue(s, true, '2026-11-04')).toBe(true);
    expect(s.data['scene-grain-day']).toBe('2026-11-04');
    expect(grainDue(s, true, '2026-11-04')).toBe(false);
    expect(grainDue(s, true, '2026-11-05')).toBe(true);
  });

  it('is false, and stores nothing, when not under baseline', () => {
    const s = fakeStorage();
    expect(grainDue(s, false, '2026-11-04')).toBe(false);
    expect(s.data['scene-grain-day']).toBeUndefined();
  });

  it('returns false when storage throws', () => {
    expect(grainDue(throwing, true, '2026-11-04')).toBe(false);
  });
});
