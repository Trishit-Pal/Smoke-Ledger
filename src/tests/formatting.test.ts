import { formatInr, formatMoney, formatDelta, formatCompactInt, pluralize } from '@/lib/format';
import {
  dayOfWeekShort,
  formatIndianDate,
  hourBucketLabel,
  startOfWeekIst,
  daysBetween,
} from '@/lib/date';

describe('formatInr', () => {
  it('formats small numbers with ₹', () => {
    expect(formatInr(250)).toBe('₹250');
    expect(formatInr(0)).toBe('₹0');
  });

  it('uses Indian numbering system', () => {
    expect(formatInr(100000)).toBe('₹1,00,000');
    expect(formatInr(1234567)).toBe('₹12,34,567');
  });

  it('handles compact mode', () => {
    expect(formatInr(2500, { compact: true })).toBe('₹2.5k');
    expect(formatInr(250000, { compact: true })).toBe('₹2.5L');
    expect(formatInr(15000000, { compact: true })).toBe('₹1.5Cr');
  });

  it('renders em-dash for null/NaN', () => {
    expect(formatInr(null)).toBe('—');
    expect(formatInr(undefined)).toBe('—');
    expect(formatInr(Number.NaN)).toBe('—');
  });

  it('shows decimal when non-zero fractional component', () => {
    expect(formatInr(12.5)).toBe('₹12.50');
  });

  it('handles negatives', () => {
    expect(formatInr(-250)).toBe('-₹250');
    expect(formatInr(-2500, { compact: true })).toBe('-₹2.5k');
  });
});

describe('formatMoney', () => {
  it('keeps Indian grouping and lakh compact for INR', () => {
    expect(formatMoney(100000, 'INR')).toBe('₹1,00,000');
    expect(formatMoney(250000, 'INR', { compact: true })).toBe('₹2.5L');
    expect(formatMoney(0.45, 'INR')).toBe('₹0.45');
  });

  it('formats EUR with the country locale, and those four locales are not the same string', () => {
    const opts = { style: 'currency', currency: 'EUR' } as const;
    const fr = formatMoney(1234.5, 'EUR', { locale: 'fr-FR' });
    const de = formatMoney(1234.5, 'EUR', { locale: 'de-DE' });
    const ie = formatMoney(1234.5, 'EUR', { locale: 'en-IE' });
    const nl = formatMoney(1234.5, 'EUR', { locale: 'nl-NL' });
    expect(fr).toBe(new Intl.NumberFormat('fr-FR', opts).format(1234.5));
    expect(de).toBe(new Intl.NumberFormat('de-DE', opts).format(1234.5));
    expect(ie).toBe(new Intl.NumberFormat('en-IE', opts).format(1234.5));
    expect(nl).toBe(new Intl.NumberFormat('nl-NL', opts).format(1234.5));
    expect(new Set([fr, de, ie, nl]).size).toBe(4);
    for (const locale of ['fr-FR', 'de-DE', 'en-IE', 'nl-NL'] as const) {
      const parts = new Intl.NumberFormat(locale, opts).formatToParts(1234.5);
      expect(parts.some((p) => p.type === 'currency')).toBe(true);
      expect(formatMoney(1234.5, 'EUR', { locale })).toContain(
        parts.find((p) => p.type === 'decimal')?.value,
      );
    }
  });

  it('compacts EUR with k and M, never lakh or crore', () => {
    expect(formatMoney(2500, 'EUR', { compact: true, locale: 'fr-FR' })).toBe('€2.5k');
    expect(formatMoney(1_500_000, 'EUR', { compact: true })).toBe('€1.5M');
    expect(formatMoney(250000, 'EUR', { compact: true })).not.toMatch(/L|Cr/);
  });
});

describe('formatDelta', () => {
  it('prefixes positive deltas with +', () => {
    expect(formatDelta(12.3)).toBe('+12.3%');
    expect(formatDelta(-5)).toBe('-5%');
    expect(formatDelta(0)).toBe('0%');
  });

  it('returns em-dash for infinity', () => {
    expect(formatDelta(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatCompactInt', () => {
  it('shortens with k / M', () => {
    expect(formatCompactInt(1500)).toBe('1.5k');
    expect(formatCompactInt(2_500_000)).toBe('2.5M');
    expect(formatCompactInt(200)).toBe('200');
  });
});

describe('pluralize', () => {
  it('picks singular or plural', () => {
    expect(pluralize(1, 'day', 'days')).toBe('day');
    expect(pluralize(3, 'day', 'days')).toBe('days');
  });
});

describe('date helpers', () => {
  it('formats DD/MM/YYYY', () => {
    expect(formatIndianDate('2025-04-18')).toBe('18/04/2025');
  });

  it('gives three-letter weekday', () => {
    // 2025-04-18 is Friday
    expect(dayOfWeekShort('2025-04-18')).toBe('Fri');
  });

  it('formats hour bucket as HH:00-HH:00', () => {
    expect(hourBucketLabel(9)).toBe('09:00–10:00');
    expect(hourBucketLabel(23)).toBe('23:00–00:00');
  });

  it('startOfWeek returns Monday of that week', () => {
    // 2025-04-18 is Friday → Monday is 2025-04-14
    expect(startOfWeekIst('2025-04-18')).toBe('2025-04-14');
  });

  it('daysBetween is absolute', () => {
    expect(daysBetween('2025-04-01', '2025-04-10')).toBe(9);
    expect(daysBetween('2025-04-10', '2025-04-01')).toBe(9);
  });
});
