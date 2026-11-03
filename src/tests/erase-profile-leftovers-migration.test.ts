import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newestFunction } from './helpers/newestMigrationFunction';

const NAME = '20261104140000_erase_profile_leftovers.sql';
const PREVIOUS = '20261104130000_health_consent.sql';
const MIGRATIONS = join(__dirname, '../../supabase/migrations');

function eraseIn(file: string): string {
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8').replace(/\r\n/g, '\n');
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.erase_account_data()');
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('$function$;', start));
}

// Comments may differ; the statements may not. The two new columns are dropped,
// and the comma after `place` normalised, so what is left must match exactly.
const statementsWithoutNewColumns = (body: string): string =>
  body
    .split('\n')
    .map((l) => l.replace(/--.*$/, '').trimEnd())
    .filter((l) => l.trim() !== '' && !/^\s*(mobile_changed_at|deleted_at)\s+= NULL,?$/.test(l))
    .join('\n')
    .replace(/place(\s+)= NULL,?/, 'place$1= NULL');

describe(NAME, () => {
  const { file, body } = newestFunction('erase_account_data');

  it('holds the newest erase_account_data', () => {
    expect(file >= NAME).toBe(true);
  });

  it('clears mobile_changed_at and deleted_at inside the app.erasing window', () => {
    const on = body.indexOf("set_config('app.erasing', 'on', true)");
    const off = body.indexOf("set_config('app.erasing', 'off', true)");
    for (const re of [/mobile_changed_at\s+= NULL/, /deleted_at\s+= NULL/]) {
      const at = body.search(re);
      expect(at).toBeGreaterThan(on);
      expect(at).toBeLessThan(off);
    }
  });

  it('leaves country and currency: regional settings the app needs after erase', () => {
    expect(body).not.toMatch(/\b(country|currency)\s*=/);
  });

  it('is a copy-forward of the previous definition plus exactly the two new columns', () => {
    expect(statementsWithoutNewColumns(eraseIn(NAME))).toBe(statementsWithoutNewColumns(eraseIn(PREVIOUS)));
  });

  it('keeps SECURITY DEFINER and an empty search_path', () => {
    const header = body.slice(0, body.indexOf('AS $function$'));
    expect(header).toContain('SECURITY DEFINER');
    expect(header).toContain("SET search_path TO ''");
  });
});
