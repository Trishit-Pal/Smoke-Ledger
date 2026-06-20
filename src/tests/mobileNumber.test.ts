import {
  normalizeToE164,
  normalizeIndianMobile,
  INDIA_MOBILE_RE,
  nextMobileChangeDate,
  canChangeMobile,
} from '@/lib/mobileNumber';

describe('normalizeIndianMobile', () => {
  it('prefixes +91 for a bare 10-digit Indian mobile (lead 6-9)', () => {
    expect(normalizeIndianMobile('9876543210')).toBe('+919876543210');
    expect(normalizeIndianMobile('6000000000')).toBe('+916000000000');
  });

  it('compacts separators and keeps a valid +91 number', () => {
    expect(normalizeIndianMobile('+91 98765 43210')).toBe('+919876543210');
    expect(normalizeIndianMobile('+91-98765-43210')).toBe('+919876543210');
  });

  it('adds the missing + when 91 + 10 digits is present', () => {
    expect(normalizeIndianMobile('919876543210')).toBe('+919876543210');
  });

  it('rejects a leading digit outside 6-9', () => {
    expect(normalizeIndianMobile('5876543210')).toBeNull();
    expect(normalizeIndianMobile('0987654321')).toBeNull();
    expect(normalizeIndianMobile('+915876543210')).toBeNull();
  });

  it('rejects non-Indian country codes', () => {
    expect(normalizeIndianMobile('+14155552671')).toBeNull();
    expect(normalizeIndianMobile('+447911123456')).toBeNull();
  });

  it('rejects wrong-length, empty, and junk input', () => {
    expect(normalizeIndianMobile('98765432')).toBeNull();
    expect(normalizeIndianMobile('98765432109')).toBeNull();
    expect(normalizeIndianMobile('')).toBeNull();
    expect(normalizeIndianMobile('abcd')).toBeNull();
  });
});

describe('INDIA_MOBILE_RE', () => {
  it('matches only +91 followed by 10 digits starting 6-9', () => {
    expect(INDIA_MOBILE_RE.test('+919876543210')).toBe(true);
    expect(INDIA_MOBILE_RE.test('+915876543210')).toBe(false);
    expect(INDIA_MOBILE_RE.test('+9198765432')).toBe(false);
    expect(INDIA_MOBILE_RE.test('9876543210')).toBe(false);
  });
});

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
