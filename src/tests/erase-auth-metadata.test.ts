import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(__dirname, '../../supabase/migrations');
const NAME = '20261104100000_erase_auth_metadata.sql';

function read(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf8').replace(/\r\n/g, '\n');
}

function eraseBody(sql: string): string {
  return sql.split('CREATE OR REPLACE FUNCTION public.erase_account_data')[1] ?? '';
}

describe(NAME, () => {
  const sql = read(NAME);
  const erase = eraseBody(sql);

  it('is the newest definition of erase_account_data', () => {
    const defining = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .filter((f) => /FUNCTION public\.erase_account_data/.test(read(f)))
      .sort();
    expect(defining[defining.length - 1]).toBe(NAME);
  });

  it('removes name, DOB and gender from the sign-in record for this user only', () => {
    expect(erase).toMatch(
      /UPDATE auth\.users\s+SET raw_user_meta_data = raw_user_meta_data - 'full_name' - 'date_of_birth' - 'gender'\s+WHERE id = uid;/,
    );
  });

  it("deletes the user's own error_events instead of keeping their text", () => {
    expect(erase).toMatch(/DELETE FROM public\.error_events\s+WHERE user_id = uid;/);
    expect(erase).not.toMatch(/UPDATE public\.error_events/);
  });

  it('keeps the audit anonymisation and the erasure-proof row', () => {
    expect(erase).toMatch(/UPDATE public\.audit_events/);
    expect(erase).toContain("'account_data_erased'");
  });

  it('no longer stamps deleted_at: the account stays live', () => {
    expect(erase).not.toMatch(/deleted_at/);
  });

  it('keeps SECURITY DEFINER, an empty search_path and the fail-closed pepper guard', () => {
    const header = erase.slice(0, erase.indexOf('AS $function$'));
    expect(header).toContain('SECURITY DEFINER');
    expect(header).toContain("SET search_path TO ''");
    expect(erase).toContain("RAISE EXCEPTION 'audit pepper is not configured");
    expect(erase).toContain("set_config('app.erasing', 'on', true)");
  });

  it('clears the profile identity columns as before', () => {
    for (const col of ['full_name', 'date_of_birth', 'gender', 'mobile_e164', 'place']) {
      expect(erase).toMatch(new RegExp(`${col}\\s*=\\s*NULL`));
    }
  });
});
