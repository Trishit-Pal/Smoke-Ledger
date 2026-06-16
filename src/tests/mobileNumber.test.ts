import { normalizeToE164, nextMobileChangeDate, canChangeMobile } from '@/lib/mobileNumber';

describe('normalizeToE164', () => {
  it('prefixes the default country code for a bare 10-digit Indian number', () => {
    expect(normalizeToE164('9876543210')).toBe('+919876543210');
  });

  it('compacts separators on an already-E.164 number', () => {
    expect(normalizeToE164('+91 98765 43210')).toBe('+919876543210');
    expect(normalizeToE164('+1 (415) 555-2671')).toBe('+14155552671');
  });

  it('adds the missing + when the country code is present', () => {
    expect(normalizeToE164('919876543210')).toBe('+919876543210');
  });

  it('rejects junk, empty, too-short, and leading-zero numbers', () => {
    expect(normalizeToE164('abcd')).toBeNull();
    expect(normalizeToE164('')).toBeNull();
    expect(normalizeToE164('123')).toBeNull();
    expect(normalizeToE164('+0123456789')).toBeNull();
  });
});

describe('nextMobileChangeDate', () => {
  it('returns null when the number has never been set', () => {
    expect(nextMobileChangeDate(null)).toBeNull();
    expect(nextMobileChangeDate(undefined)).toBeNull();
  });

  it('returns changed-at + 30 days', () => {
    const next = nextMobileChangeDate('2026-06-01T00:00:00.000Z');
    expect(next?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('returns null for an unparseable timestamp', () => {
    expect(nextMobileChangeDate('not-a-date')).toBeNull();
  });
});

describe('canChangeMobile', () => {
  const changed = '2026-06-01T00:00:00.000Z';

  it('allows a change when never set', () => {
    expect(canChangeMobile(null, new Date('2026-06-15T00:00:00Z'))).toBe(true);
  });

  it('blocks a change inside the 30-day window', () => {
    expect(canChangeMobile(changed, new Date('2026-06-15T00:00:00Z'))).toBe(false);
  });

  it('allows a change once the window has elapsed', () => {
    expect(canChangeMobile(changed, new Date('2026-07-02T00:00:00Z'))).toBe(true);
  });
});
