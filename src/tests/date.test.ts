import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
  startOfWeekIst,
  startOfMonthIst,
  formatIndianDate,
  formatDatetimeLocalIst,
  parseDatetimeLocalIst,
  toLocalDate,
  toLocalHour,
  IST,
} from '@/lib/date';

dayjs.extend(utc);
dayjs.extend(timezone);

describe('IST date helpers', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it('startOfWeekIst is stable under non-IST host TZ', () => {
    process.env.TZ = 'America/New_York';
    expect(startOfWeekIst('2025-04-18')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('startOfMonthIst returns first of month', () => {
    process.env.TZ = 'UTC';
    expect(startOfMonthIst('2025-04-18')).toBe('2025-04-01');
  });

  it('formatIndianDate parses YMD in IST', () => {
    process.env.TZ = 'Pacific/Auckland';
    const label = formatIndianDate('2025-04-18');
    expect(label.length).toBeGreaterThan(3);
    expect(label).not.toBe('Invalid Date');
  });
});

/*
 * The datetime-local picker in BackdateTimeField is timezone-naive: it shows a
 * bare wall clock. These helpers bridge that wall clock to/from an absolute
 * instant by interpreting it as IST, so a backdated log is correct even when
 * the user's device timezone isn't IST. IST is UTC+5:30, no DST.
 */
describe('country-local calendar', () => {
  it('stores 21:00 Europe/Paris on that calendar day, which is already the next day in IST', () => {
    const ts = dayjs.tz('2026-07-15 21:00', 'YYYY-MM-DD HH:mm', 'Europe/Paris').toISOString();
    expect(toLocalDate(ts, 'Europe/Paris')).toBe('2026-07-15');
    expect(toLocalHour(ts, 'Europe/Paris')).toBe(21);
    expect(toLocalDate(ts, IST)).toBe('2026-07-16');
  });

  it('keeps the Paris wall clock across the spring-forward boundary', () => {
    const before = dayjs.tz('2026-03-29 01:30', 'YYYY-MM-DD HH:mm', 'Europe/Paris').toISOString();
    const after = dayjs.tz('2026-03-29 03:30', 'YYYY-MM-DD HH:mm', 'Europe/Paris').toISOString();
    expect(toLocalDate(before, 'Europe/Paris')).toBe('2026-03-29');
    expect(toLocalHour(before, 'Europe/Paris')).toBe(1);
    expect(toLocalDate(after, 'Europe/Paris')).toBe('2026-03-29');
    expect(toLocalHour(after, 'Europe/Paris')).toBe(3);
  });

  it('still defaults to IST when no zone is passed', () => {
    const ts = '2026-07-15T18:30:00.000Z';
    expect(toLocalDate(ts)).toBe('2026-07-16');
    expect(toLocalHour(ts)).toBe(0);
  });
});

describe('IST datetime-local picker helpers', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it('parseDatetimeLocalIst reads the wall clock as IST regardless of host TZ', () => {
    process.env.TZ = 'America/New_York';
    // 14:30 IST == 09:00 UTC.
    expect(parseDatetimeLocalIst('2026-06-24T14:30')?.toISOString()).toBe(
      '2026-06-24T09:00:00.000Z',
    );
  });

  it('formatDatetimeLocalIst renders an instant in IST wall clock regardless of host TZ', () => {
    process.env.TZ = 'America/New_York';
    expect(formatDatetimeLocalIst(new Date('2026-06-24T09:00:00.000Z'))).toBe(
      '2026-06-24T14:30',
    );
  });

  it('round-trips a picked value through IST', () => {
    process.env.TZ = 'UTC';
    const original = '2026-01-15T08:05';
    expect(formatDatetimeLocalIst(parseDatetimeLocalIst(original))).toBe(original);
  });

  it('derived local_date / local_hour match the IST wall clock of a backdated pick', () => {
    process.env.TZ = 'Pacific/Auckland';
    const iso = parseDatetimeLocalIst('2026-06-24T23:45')!.toISOString();
    expect(toLocalDate(iso)).toBe('2026-06-24');
    expect(toLocalHour(iso)).toBe(23);
  });

  it('returns null / empty for invalid input', () => {
    expect(parseDatetimeLocalIst('')).toBeNull();
    expect(parseDatetimeLocalIst('not-a-date')).toBeNull();
    expect(formatDatetimeLocalIst(null)).toBe('');
  });
});
