import { milestoneProgress, minutesSince, formatMinutesUntil } from '@/domain/health';

const ISO = (mins: number, base = new Date('2026-05-04T12:00:00Z')) =>
  new Date(base.getTime() - mins * 60_000).toISOString();
const NOW = new Date('2026-05-04T12:00:00Z');

describe('minutesSince', () => {
  it('returns 0 when no last smoke', () => {
    expect(minutesSince(null, NOW)).toBe(0);
    expect(minutesSince(undefined, NOW)).toBe(0);
  });
  it('returns 0 for invalid iso', () => {
    expect(minutesSince('not-a-date', NOW)).toBe(0);
  });
  it('counts elapsed minutes', () => {
    expect(minutesSince(ISO(15), NOW)).toBe(15);
  });
  it('clamps negative (future) to 0', () => {
    const future = new Date(NOW.getTime() + 60_000).toISOString();
    expect(minutesSince(future, NOW)).toBe(0);
  });
});

describe('milestoneProgress', () => {
  it('no last smoke → current null, next is first milestone (20 min)', () => {
    const p = milestoneProgress(null, NOW);
    expect(p.current).toBeNull();
    expect(p.next?.minutes).toBe(20);
    expect(p.fractionToNext).toBe(0);
  });

  it('just below 20 min → still no current, next at 20', () => {
    const p = milestoneProgress(ISO(19), NOW);
    expect(p.current).toBeNull();
    expect(p.next?.minutes).toBe(20);
    expect(p.fractionToNext).toBeCloseTo(19 / 20, 2);
    expect(p.minutesToNext).toBe(1);
  });

  it('exactly 20 min → current is 20, next is 8h', () => {
    const p = milestoneProgress(ISO(20), NOW);
    expect(p.current?.minutes).toBe(20);
    expect(p.next?.minutes).toBe(480);
  });

  it('between 20 min and 8 h → progresses toward 8h', () => {
    const p = milestoneProgress(ISO(60), NOW); // 1 hour
    expect(p.current?.minutes).toBe(20);
    expect(p.next?.minutes).toBe(480);
    // (60-20)/(480-20) = 40/460
    expect(p.fractionToNext).toBeCloseTo(40 / 460, 3);
  });

  it('past final milestone (15y) → next is null, fraction is 1', () => {
    const p = milestoneProgress(ISO(8_000_000), NOW); // > 15y
    expect(p.next).toBeNull();
    expect(p.fractionToNext).toBe(1);
    expect(p.minutesToNext).toBe(0);
  });
});

describe('formatMinutesUntil', () => {
  it.each([
    [0, 'now'],
    [-5, 'now'],
    [45, '45m'],
    [60, '1h'],
    [75, '1h 15m'],
    [1440, '1d'],
    [1500, '1d 1h'],
    [44640, '1 mo'],
    [525600, '1y'],
  ])('%i min → %s', (m, expected) => {
    expect(formatMinutesUntil(m)).toBe(expected);
  });
});
