import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const NAME = '20261105110000_marketing_consent_null_trigger.sql';
const sql = readFileSync(join(__dirname, '../../supabase/migrations', NAME), 'utf8').replace(/\r\n/g, '\n');

describe(NAME, () => {
  it('drops the CHECK that made an older mobile build fail with 23514', () => {
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS user_profiles_marketing_consent_unused/);
    expect(sql).not.toMatch(/ADD CONSTRAINT/);
  });

  it('nulls the column on every insert and update', () => {
    expect(sql).toMatch(/NEW\.marketing_consent_at := NULL/);
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_user_profiles_marketing_consent_null ON public\.user_profiles/);
    expect(sql).toMatch(
      /CREATE TRIGGER trg_user_profiles_marketing_consent_null\s+BEFORE INSERT OR UPDATE ON public\.user_profiles\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.null_marketing_consent_at\(\)/,
    );
  });

  it('is a SECURITY INVOKER function with a pinned search_path and no client EXECUTE', () => {
    const fn = sql.match(/CREATE OR REPLACE FUNCTION public\.null_marketing_consent_at\s*\(\)[\s\S]*?\$\$;/)?.[0] ?? '';
    expect(fn).toMatch(/RETURNS trigger/);
    expect(fn).toMatch(/SECURITY INVOKER/);
    expect(fn).toMatch(/SET search_path = ''/);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.null_marketing_consent_at\(\) FROM PUBLIC, anon, authenticated/,
    );
  });
});
