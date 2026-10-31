import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(__dirname, '../../supabase/migrations');

const REGION_MIGRATIONS = [
  '20261013120000_region_currency.sql',
  '20261013140000_eu_french_catalog.sql',
  '20261013150000_region_seed_swap.sql',
] as const;

describe('scripts/sql/smoke.sql', () => {
  it('fails CI when pg_cron is installed but the counters purge is not scheduled', () => {
    const smoke = readFileSync(join(__dirname, '../../scripts/sql/smoke.sql'), 'utf8');
    expect(smoke).toMatch(/extname = 'pg_cron'/);
    expect(smoke).toMatch(/jobname = 'purge-rate-limit-counters'/);
  });
});

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
}

/** Every `REVOKE ALL ON FUNCTION public.* ... FROM ...` line in a migration. */
function publicRevokes(sql: string): string[] {
  return sql.match(/^REVOKE ALL ON FUNCTION public\.[^;]+;/gm) ?? [];
}

describe('region migrations: SECURITY DEFINER lockdown', () => {
  it.each(REGION_MIGRATIONS)('%s revokes anon explicitly, not only PUBLIC', (name) => {
    const revokes = publicRevokes(readMigration(name));
    expect(revokes.length).toBeGreaterThan(0);
    for (const stmt of revokes) {
      // Supabase grants anon EXECUTE directly; REVOKE ... FROM PUBLIC does not remove that grant.
      expect(stmt).toMatch(/FROM PUBLIC, anon;$/);
    }
  });

  it.each(REGION_MIGRATIONS)(
    '%s revokes PUBLIC and anon from every public SECURITY DEFINER function it defines',
    (name) => {
      const sql = readMigration(name);
      const revokes = publicRevokes(sql).join('\n');
      const fns = sql.split(/CREATE OR REPLACE FUNCTION public\./).slice(1);
      for (const fn of fns) {
        const header = fn.slice(0, fn.indexOf('AS $$'));
        if (!/SECURITY DEFINER/.test(header)) continue;
        const fnName = fn.slice(0, fn.indexOf('('));
        // smoke.sql fails CI if anon can EXECUTE any public SECURITY DEFINER function,
        // and anon inherits EXECUTE through PUBLIC on every new function.
        expect(revokes).toMatch(
          new RegExp(`REVOKE ALL ON FUNCTION public\\.${fnName}\\([^)]*\\) FROM PUBLIC, anon;`),
        );
      }
    },
  );

  it('pins an empty search_path on every public SECURITY DEFINER function', () => {
    for (const name of REGION_MIGRATIONS) {
      const sql = readMigration(name);
      const fns = sql.split(/CREATE OR REPLACE FUNCTION public\./).slice(1);
      for (const fn of fns) {
        const header = fn.slice(0, fn.indexOf('AS $$'));
        if (/SECURITY DEFINER/.test(header)) {
          expect(header).toContain("SET search_path = ''");
        }
      }
    }
  });
});

describe('20261030000000_security_hardening.sql', () => {
  const sql = readMigration('20261030000000_security_hardening.sql');
  const erase = sql.split('CREATE OR REPLACE FUNCTION public.erase_account_data')[1] ?? '';

  it('removes anon grants from existing and future public objects', () => {
    expect(sql).toMatch(/REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;/);
    expect(sql).toMatch(/REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;/);
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;/,
    );
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;/,
    );
  });

  it('erase_account_data clears identity fields the privacy page promises to erase', () => {
    for (const col of ['full_name', 'date_of_birth', 'gender', 'mobile_e164', 'place']) {
      expect(erase).toMatch(new RegExp(`${col}\\s*=\\s*NULL`));
    }
    // Erase must keep its fail-closed pepper guard.
    expect(erase).toContain("RAISE EXCEPTION 'audit pepper is not configured");
    expect(erase).toContain("set_config('app.erasing', 'on', true)");
    expect(erase.indexOf("set_config('app.erasing'")).toBeLessThan(
      erase.indexOf('UPDATE public.user_profiles'),
    );
  });

  it('lets only the erase path bypass the identity-immutability trigger', () => {
    const trigger = sql.split('CREATE OR REPLACE FUNCTION public.enforce_profile_identity_rules')[1] ?? '';
    expect(trigger).toContain("current_setting('app.erasing', true) = 'on'");
    expect(trigger.indexOf('app.erasing')).toBeLessThan(trigger.indexOf('identity_immutable'));
  });

  it('stops new functions from being anon-callable through the PUBLIC default', () => {
    // anon inherits EXECUTE via PUBLIC; a schema-scoped revoke from anon alone cannot remove it.
    expect(sql).toMatch(/^ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;/m);
  });

  it('caps usage_events payloads without rewriting existing rows', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.usage_events[\s\S]*?octet_length\(props_json::text\) <= 4096\) NOT VALID/,
    );
  });

  it('does not re-add the error_events size cap that already exists', () => {
    expect(readMigration('20260520000000_security_correctness.sql')).toContain(
      'error_events_details_size_check',
    );
    expect(sql).not.toMatch(/ADD CONSTRAINT error_events_details_size_check/);
  });

  it('purges expired rate-limit counters, callable only by the service role', () => {
    const purge = sql.split('CREATE OR REPLACE FUNCTION public.purge_rate_limit_counters')[1] ?? '';
    expect(purge).toContain('SECURITY DEFINER');
    expect(purge).toContain("SET search_path = ''");
    expect(purge).toMatch(/DELETE FROM public\.rate_limit_counters\s+WHERE window_start < now\(\) - interval '2 days'/);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.purge_rate_limit_counters\(\) FROM PUBLIC, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.purge_rate_limit_counters\(\) TO service_role;/,
    );
  });

  it('enables pg_cron so the purge is actually scheduled, without failing the migration if it cannot', () => {
    // Production had no pg_cron, so the conditional schedule silently never ran.
    expect(sql).toMatch(
      /BEGIN\s+CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;\s+EXCEPTION WHEN OTHERS THEN/,
    );
    expect(sql.indexOf('CREATE EXTENSION IF NOT EXISTS pg_cron')).toBeLessThan(
      sql.indexOf("IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')"),
    );
    expect(sql).toMatch(/cron\.schedule\(\s*'purge-rate-limit-counters'/);
  });

  it('drops every existing counter row once, since rows written before hashing hold raw emails and IPs', () => {
    expect(sql).toMatch(/^DELETE FROM public\.rate_limit_counters;$/m);
  });

  it('records on the erase audit row that identity fields were cleared', () => {
    const insert = erase.slice(erase.indexOf('INSERT INTO public.audit_events'));
    expect(insert).toMatch(/'prior_identity_erased',\s*true/);
  });

  it('drops the auth_email_exists oracle now that the login lookup is gone', () => {
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.auth_email_exists\(text\);/);
  });
});

describe('reset_ledger_for_region', () => {
  const sql = readMigration('20261013120000_region_currency.sql');
  const fn = sql.split('CREATE OR REPLACE FUNCTION public.reset_ledger_for_region')[1] ?? '';
  const beforeDelete = fn.slice(0, fn.indexOf('DELETE FROM public.cigarette_logs'));

  it('refuses before deleting anything when the currency would not change', () => {
    expect(fn.indexOf('DELETE FROM public.cigarette_logs')).toBeGreaterThan(-1);
    expect(beforeDelete).toContain("RAISE EXCEPTION 'region_reset_not_needed'");
    expect(beforeDelete).toMatch(/IS NOT DISTINCT FROM/);
  });
});

// Phase 4: direct INSERT on cigarette_logs let a signed-in client skip the
// 50-per-hour cap in create_log_with_rate_limit. Logs are written only by the RPC.
describe('20261031000000_logs_insert_via_rpc.sql', () => {
  const sql = readMigration('20261031000000_logs_insert_via_rpc.sql');

  it('replaces the catch-all policy with read, update and delete policies only', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS logs_all ON public\.cigarette_logs;/);
    for (const cmd of ['SELECT', 'UPDATE', 'DELETE']) {
      expect(sql).toContain(`ON public.cigarette_logs
  FOR ${cmd} TO authenticated`);
    }
    expect(sql).not.toMatch(/FOR (INSERT|ALL)/);
  });

  it('revokes the table INSERT privilege from signed-in clients', () => {
    expect(sql).toMatch(/REVOKE INSERT ON public\.cigarette_logs FROM authenticated;/);
  });
});
