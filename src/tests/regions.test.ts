import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REGIONS,
  currencyFor,
  isRegionPickerEnabled,
  regionFor,
  regionOptions,
  timezoneForCountry,
} from '@/lib/regions';

const EU = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
] as const;

describe('regions', () => {
  it('lists India and the 27 EU members, each once', () => {
    const codes = REGIONS.map((r) => r.country);
    expect(new Set(codes).size).toBe(28);
    expect(codes).toContain('IN');
    for (const code of EU) expect(codes).toContain(code);
  });

  it('maps India to INR and every EU member, including the non-euro six, to EUR', () => {
    expect(currencyFor('IN')).toBe('INR');
    expect(currencyFor(null)).toBe('INR');
    expect(currencyFor(undefined)).toBe('INR');
    for (const code of EU) expect(currencyFor(code)).toBe('EUR');
    for (const code of ['PL', 'SE', 'DK', 'CZ', 'HU', 'RO'] as const) {
      expect(currencyFor(code)).toBe('EUR');
    }
  });

  it('gives India a rupee stick hint and leaves EU hints empty until a cited WAP exists', () => {
    expect(regionFor('IN')?.stickHint).toBe(18);
    expect(regionFor('IN')?.timezone).toBe('Asia/Kolkata');
    for (const code of EU) {
      expect(regionFor(code)?.stickHint).toBeNull();
      expect(regionFor(code)?.market).toBe('EU');
      expect(regionFor(code)?.timezone.length).toBeGreaterThan(0);
      expect(regionFor(code)?.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });

  it('uses a distinct locale for France, Germany, Ireland, and the Netherlands', () => {
    const locales = ['FR', 'DE', 'IE', 'NL'].map((c) => regionFor(c)?.locale);
    expect(new Set(locales).size).toBe(4);
    expect(locales).toEqual(['fr-FR', 'de-DE', 'en-IE', 'nl-NL']);
  });

  it('puts India first in the picker, then the rest by name', () => {
    const options = regionOptions();
    expect(options[0]).toEqual({ value: 'IN', label: 'India' });
    expect(options).toHaveLength(28);
    const names = options.slice(1).map((o) => o.label);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it('resolves a canonical zone for Paris and keeps an unknown code off the ledger', () => {
    expect(timezoneForCountry('FR')).toBe('Europe/Paris');
    expect(timezoneForCountry(null)).toBe('Asia/Kolkata');
    expect(regionFor('US')).toBeNull();
  });

  it('hides the picker unless the env flag is exactly true', () => {
    const prev = process.env.NEXT_PUBLIC_REGION_PICKER;
    delete process.env.NEXT_PUBLIC_REGION_PICKER;
    expect(isRegionPickerEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_REGION_PICKER = 'false';
    expect(isRegionPickerEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_REGION_PICKER = 'true';
    expect(isRegionPickerEnabled()).toBe(true);
    if (prev === undefined) delete process.env.NEXT_PUBLIC_REGION_PICKER;
    else process.env.NEXT_PUBLIC_REGION_PICKER = prev;
  });

  it('matches the SQL region seed row for row', () => {
    const sql = readFileSync(
      join(__dirname, '../../supabase/migrations/20261013120000_region_currency.sql'),
      'utf8',
    );
    const block = sql.split('-- region-rows:begin')[1]?.split('-- region-rows:end')[0] ?? '';
    const rows = [...block.matchAll(/\('([A-Z]{2})',\s*'([A-Z]{3})',\s*'(IN|EU)',\s*'([^']+)',\s*'([^']+)',\s*(NULL|\d+(?:\.\d+)?)\)/g)];
    expect(rows).toHaveLength(REGIONS.length);
    const byCode = new Map(REGIONS.map((r) => [r.country, r]));
    for (const [, country, currency, market, locale, timezone, hint] of rows) {
      const region = byCode.get(country);
      expect(region).toBeDefined();
      expect(region?.currency).toBe(currency);
      expect(region?.market).toBe(market);
      expect(region?.locale).toBe(locale);
      expect(region?.timezone).toBe(timezone);
      expect(region?.stickHint).toBe(hint === 'NULL' ? null : Number(hint));
    }
  });
});
