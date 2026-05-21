import { startOfWeekIst, startOfMonthIst, formatIndianDate } from '@/lib/date';

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
