import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newestFunction } from './helpers/newestMigrationFunction';

const NAME = '20261104130000_health_consent.sql';
const sql = readFileSync(join(__dirname, '../../supabase/migrations', NAME), 'utf8').replace(
  /\r\n/g,
  '\n',
);

describe(NAME, () => {
  it('adds a nullable health_data_consent_at column idempotently', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.user_profiles\s+ADD COLUMN IF NOT EXISTS health_data_consent_at timestamptz;/,
    );
    expect(sql).not.toMatch(/health_data_consent_at timestamptz\s+(NOT NULL|DEFAULT)/);
  });

  it('does not backfill: existing users never gave an explicit health consent', () => {
    expect(sql).not.toMatch(/UPDATE public\.user_profiles\s+SET health_data_consent_at\s*=\s*(now|data_processing)/i);
  });
});

describe('newest erase_account_data', () => {
  const { file, body } = newestFunction('erase_account_data');

  it('is this migration or a later copy-forward, so the column is cleared and the earlier fixes are kept', () => {
    expect(file >= NAME).toBe(true);
  });

  it('clears the health consent stamp with the other consent columns', () => {
    expect(body).toMatch(/health_data_consent_at\s*=\s*NULL/);
    expect(body).toMatch(/data_processing_consent_at\s*=\s*NULL/);
  });

  it('keeps SECURITY DEFINER and an empty search_path', () => {
    const header = body.slice(0, body.indexOf('AS $function$'));
    expect(header).toContain('SECURITY DEFINER');
    expect(header).toContain("SET search_path TO ''");
  });
});

describe('export carries the health consent stamp', () => {
  it('exports the whole caller profile row, so the new column comes with it', () => {
    const { body } = newestFunction('export_account_data');
    expect(body).toMatch(/'profile', \(\s+SELECT to_jsonb\(p\) - 'id'\s+FROM public\.user_profiles p\s+WHERE p\.id = uid/);
  });
});

describe('delete_my_usage_events', () => {
  const fn = sql.split('CREATE OR REPLACE FUNCTION public.delete_my_usage_events')[1] ?? '';
  const header = fn.slice(0, fn.indexOf('AS $$'));

  it('is SECURITY DEFINER with an empty search_path', () => {
    expect(header).toContain('SECURITY DEFINER');
    expect(header).toContain("SET search_path = ''");
  });

  it("deletes only the caller's rows and refuses an anonymous caller", () => {
    expect(fn).toMatch(/uid uuid := auth\.uid\(\)/);
    expect(fn).toMatch(/IF uid IS NULL THEN\s+RAISE EXCEPTION 'not authenticated'/);
    expect(fn).toMatch(/DELETE FROM public\.usage_events\s+WHERE user_id = uid/);
  });

  it('is revoked from PUBLIC and anon, granted to authenticated only', () => {
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.delete_my_usage_events\(\) FROM PUBLIC, anon;/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.delete_my_usage_events\(\) TO authenticated;/,
    );
  });
});
