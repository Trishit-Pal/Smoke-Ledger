import { computeAge, isAdult, MIN_AGE } from '@/domain/age';

// Build the reference "today" from local parts so the result is independent of
// the test runner's timezone (computeAge reads local Y/M/D).
const onJune16 = (year: number) => new Date(year, 5, 16); // month is 0-based → June

describe('computeAge', () => {
  it('returns the completed years for a normal adult', () => {
    expect(computeAge('1990-01-01', onJune16(2026))).toBe(36);
  });

  it('counts the 18th birthday itself as 18', () => {
    expect(computeAge('2008-06-16', onJune16(2026))).toBe(18);
  });

  it('is still 17 the day before the 18th birthday', () => {
    // DOB one day after "today" in the birth-month → birthday not reached.
    expect(computeAge('2008-06-17', onJune16(2026))).toBe(17);
  });

  it('treats a Feb-29 birthday as turning 18 on Mar 1 in a non-leap year', () => {
    expect(computeAge('2000-02-29', new Date(2018, 1, 28))).toBe(17); // Feb 28
    expect(computeAge('2000-02-29', new Date(2018, 2, 1))).toBe(18); // Mar 1
  });

  it('returns null for malformed or impossible dates', () => {
    expect(computeAge('not-a-date', onJune16(2026))).toBeNull();
    expect(computeAge('2021-02-30', onJune16(2026))).toBeNull();
    expect(computeAge('2000-13-01', onJune16(2026))).toBeNull();
    expect(computeAge('2000-1-1', onJune16(2026))).toBeNull();
  });
});

describe('isAdult', () => {
  it('MIN_AGE is 18', () => {
    expect(MIN_AGE).toBe(18);
  });

  it('is true at exactly 18 and false at 17', () => {
    expect(isAdult('2008-06-16', onJune16(2026))).toBe(true);
    expect(isAdult('2008-06-17', onJune16(2026))).toBe(false);
  });

  it('fails closed for invalid or future dates', () => {
    expect(isAdult('not-a-date', onJune16(2026))).toBe(false);
    expect(isAdult('2030-01-01', onJune16(2026))).toBe(false);
  });
});
