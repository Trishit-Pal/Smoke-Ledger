import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG_SYNC_VERSION } from '@/lib/catalogVersion';
import {
  REGIONS,
  currencyFor,
  isRegionPickerEnabled,
  regionFor,
  regionOptions,
  timezoneForCountry,
} from '@/lib/regions';

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = end ? source.indexOf(end, from + start.length) : -1;
  return from === -1 ? '' : source.slice(from, to === -1 ? undefined : to);
}

function normalizeGate(block: string): string {
  return block.replace(/auth\.uid\(\)|uid|NEW\.id/g, 'UID').replace(/\s+/g, ' ').trim();
}

const EU_CATALOG_SQL_PATH = join(__dirname, '../../supabase/migrations/20261013140000_eu_french_catalog.sql');

function euroPackPrices(sql: string): number[] {
  return [
    ...sql.matchAll(
      /\((\d+),\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*(\d+),\s*(\d+(?:\.\d+)?),\s*'EU'\)/g,
    ),
  ].map((match) => Number(match[6]));
}

/** Even-count median of the pack prices, per stick, at the 4-decimal hint precision. */
function euroStickHint(prices: number[]): number {
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  return Math.round((median / 20) * 10000) / 10000;
}

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

  it('gives India a rupee stick hint and every EU country the French median per stick', () => {
    const hint = euroStickHint(euroPackPrices(readFileSync(EU_CATALOG_SQL_PATH, 'utf8')));
    expect(regionFor('IN')?.stickHint).toBe(18);
    expect(regionFor('IN')?.timezone).toBe('Asia/Kolkata');
    for (const code of EU) {
      expect(regionFor(code)?.stickHint).toBe(hint);
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
    const euSql = readFileSync(
      join(__dirname, '../../supabase/migrations/20261013140000_eu_french_catalog.sql'),
      'utf8',
    );
    const hint = euroStickHint(euroPackPrices(euSql));
    const hintSql = euSql.match(
      /UPDATE\s+smoke_seed\.region\s+SET\s+stick_hint\s*=\s*(\d+(?:\.\d+)?)\s+WHERE\s+market\s*=\s*'EU'/,
    );
    expect(hintSql).not.toBeNull();
    expect(Number(hintSql?.[1])).toBe(hint);
    const block = sql.split('-- region-rows:begin')[1]?.split('-- region-rows:end')[0] ?? '';
    const rows = [...block.matchAll(/\('([A-Z]{2})',\s*'([A-Z]{3})',\s*'(IN|EU)',\s*'([^']+)',\s*'([^']+)',\s*(NULL|\d+(?:\.\d+)?)\)/g)];
    expect(rows).toHaveLength(REGIONS.length);
    const byCode = new Map(REGIONS.map((r) => [r.country, r]));
    for (const [, country, currency, market, locale, timezone, seededHint] of rows) {
      const region = byCode.get(country);
      const stickHint = market === 'EU' ? hint : seededHint === 'NULL' ? null : Number(seededHint);
      expect(region).toBeDefined();
      expect(region?.currency).toBe(currency);
      expect(region?.market).toBe(market);
      expect(region?.locale).toBe(locale);
      expect(region?.timezone).toBe(timezone);
      expect(region?.stickHint).toBe(stickHint);
    }
  });

  it('replaces seed brands only when a currency change is allowed, and still updates the profile when it is not', () => {
    const sql = readFileSync(
      join(__dirname, '../../supabase/migrations/20261013150000_region_seed_swap.sql'),
      'utf8',
    );
    const fn = sql.split('CREATE OR REPLACE FUNCTION public.set_region')[1] ?? '';
    expect(fn).toContain("SET search_path = ''");
    expect(fn).toMatch(/REVOKE ALL ON FUNCTION public\.set_region\(text\) FROM PUBLIC/);
    expect(fn).toMatch(/GRANT EXECUTE ON FUNCTION public\.set_region\(text\) TO authenticated/);
    expect(fn).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.set_region\(text\) TO anon/);
    expect(fn).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.set_region\(text\) TO PUBLIC/);

    const blocked = sliceBetween(fn, 'blocked :=', '-- currency-swap:begin');
    expect(blocked).toMatch(/cigarette_logs l WHERE l\.user_id = uid/);
    expect(blocked).toMatch(/v\.user_id = uid AND COALESCE\(v\.price_count, 0\) > 0/);
    expect(blocked).toMatch(/g\.user_id = uid[\s\S]*spend_cap_daily/);
    expect(blocked).not.toMatch(/status/);

    const swap = sliceBetween(fn, '-- currency-swap:begin', '-- currency-swap:end');
    expect(swap).toMatch(/new_currency IS DISTINCT FROM old_currency/);
    expect(swap).toMatch(/NOT blocked/);
    expect(swap).toMatch(/is_seed = true/);
    expect(swap).toMatch(/v\.user_id = uid/);
    expect(swap).toMatch(/b\.user_id = uid/);
    expect(swap).toMatch(/WHERE user_id = uid AND is_seed = true/);
    expect(swap).not.toMatch(/UPDATE public\.user_profiles/);

    const swapEnd = fn.indexOf('-- currency-swap:end');
    const updateAt = fn.indexOf('UPDATE public.user_profiles');
    const missingAt = fn.indexOf("RAISE EXCEPTION 'profile_missing'");
    const applyAt = fn.indexOf('apply_default_brands');
    expect(updateAt).toBeGreaterThan(swapEnd);
    expect(missingAt).toBeGreaterThan(updateAt);
    expect(applyAt).toBeGreaterThan(missingAt);

    const setPred = sliceBetween(fn, 'EXISTS (SELECT 1 FROM public.cigarette_logs', '-- currency-swap:begin').replace(
      /;\s*$/,
      '',
    );
    const enforcePred = sliceBetween(sql, 'IF EXISTS (SELECT 1 FROM public.cigarette_logs', 'THEN').replace(
      /^IF\s+/,
      '',
    );
    expect(normalizeGate(setPred)).toBe(normalizeGate(enforcePred));
    expect(enforcePred).not.toMatch(/status/);

    expect(sql).toMatch(
      /CREATE TRIGGER trg_user_profiles_seed_swap[\s\S]*AFTER UPDATE OF country ON public\.user_profiles/,
    );
    const swapFn = sql.split('CREATE OR REPLACE FUNCTION public.swap_seeds_after_region_change')[1] ?? '';
    expect(swapFn).toMatch(/NEW\.currency IS DISTINCT FROM OLD\.currency/);
    expect(swapFn).toMatch(/v\.user_id = NEW\.id/);
    expect(swapFn).toMatch(/b\.user_id = NEW\.id/);
    expect(swapFn).toMatch(/WHERE user_id = NEW\.id AND is_seed = true/);
    const delAt = swapFn.indexOf('DELETE FROM public.brand_variants');
    expect(swapFn.indexOf('apply_default_brands')).toBeGreaterThan(delAt);
    expect(swapFn).not.toMatch(/GRANT EXECUTE/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.swap_seeds_after_region_change\(\) FROM PUBLIC/);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.swap_seeds_after_region_change/);
  });

  it('bumps the catalog sync version so clients pick up the EU rows', () => {
    expect(CATALOG_SYNC_VERSION).toBe('2026.3');
  });

  it('seeds the EU catalog at the French legal pack price and omits Vogue Menthe', () => {
    const sql = readFileSync(
      join(__dirname, '../../supabase/migrations/20261013140000_eu_french_catalog.sql'),
      'utf8',
    );
    const note = readFileSync(
      join(__dirname, '../../docs/catalog/2026-eu-french-pack-prices.md'),
      'utf8',
    );
    const source = 'https://www.douane.gouv.fr/sites/default/files/2026-08/12/Maquette%20JORF%201er%20septembre%202026.pdf';
    expect(sql).toContain(source);
    expect(note).toContain(source);

    const rows = [
      ...sql.matchAll(
        /\((\d+),\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*(\d+),\s*(\d+(?:\.\d+)?),\s*'EU'\)/g,
      ),
    ].map(([, sort, brand, category, variant, pack, price]) => ({
      sort: Number(sort),
      brand: brand.replace(/''/g, "'"),
      category,
      variant: variant.replace(/''/g, "'"),
      pack: Number(pack),
      price: Number(price),
    }));

    const expected = [
      ['JPS', 'regular', 'Classic Black', 13],
      ['Mayfair', 'regular', 'King Size', 13.1],
      ['Vogue', 'regular', "L'Originale Bleue", 13.5],
      ['Lambert & Butler', 'regular', 'Lambert & Butler', 13.1],
      ['Gitanes', 'regular', 'Filtre', 14.6],
      ['Gauloises', 'regular', 'Brunes', 14.2],
      ['Royale', 'regular', 'Rouge', 13.2],
      ['Fortuna', 'regular', 'Rouge', 11.4],
      ['Marlboro', 'premium', 'Red', 13.5],
      ['Camel', 'premium', 'Filters', 13],
      ['Winston', 'regular', 'Blue', 13],
      ['Lucky Strike', 'premium', 'Original Red', 13],
      ['Chesterfield', 'regular', 'Original Red', 13],
      ['L&M', 'regular', 'International Red', 13],
    ] as const;

    expect(rows).toHaveLength(expected.length);
    expect(rows.map((r) => r.sort)).toEqual(expected.map((_, i) => 272 + i));
    for (let i = 0; i < expected.length; i++) {
      const [brand, category, variant, price] = expected[i];
      expect(rows[i]).toMatchObject({ brand, category, variant, pack: 20, price });
    }
    expect(rows.some((r) => r.brand === 'Vogue' && r.variant === 'Menthe')).toBe(false);
    expect(rows.some((r) => r.brand === 'Pall Mall')).toBe(false);
    expect(sql).toContain('French list has no Pall Mall cigarette');
    expect(sql).not.toContain('India catalog already has it');
  });
});
