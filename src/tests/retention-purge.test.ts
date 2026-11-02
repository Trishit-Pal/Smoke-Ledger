import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RETENTION } from '../lib/privacy/retention';

const MIGRATIONS_DIR = join(__dirname, '../../supabase/migrations');
const read = (name: string) =>
  readFileSync(join(MIGRATIONS_DIR, name), 'utf8').replace(/\r\n/g, '\n');

const sql = read('20261104110000_retention_purge.sql');

/** The interval literal a table is purged by, e.g. ['12', 'months']. */
function purgeInterval(table: string, column: string, source = sql): [number, string] {
  const m = source.match(
    new RegExp(
      String.raw`DELETE FROM public\.${table}\s+WHERE ${column} < now\(\) - interval '(\d+) (months|days)'`,
    ),
  );
  if (!m) throw new Error(`no purge DELETE found for ${table}.${column}`);
  return [Number(m[1]), m[2]];
}

describe('20261104110000_retention_purge.sql', () => {
  it('defines purge_expired_records as SECURITY DEFINER with an empty search_path', () => {
    const header = sql.split('CREATE OR REPLACE FUNCTION public.purge_expired_records')[1] ?? '';
    expect(header).not.toBe('');
    const decl = header.slice(0, header.indexOf('AS $$'));
    expect(decl).toContain('SECURITY DEFINER');
    expect(decl).toContain("SET search_path = ''");
    expect(decl).toMatch(/RETURNS jsonb/);
  });

  it('is callable by service_role only', () => {
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.purge_expired_records\(\) FROM PUBLIC, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.purge_expired_records\(\) TO service_role;/,
    );
  });

  it('purges each table by an interval equal to the RETENTION constants', () => {
    expect(purgeInterval('audit_events', 'created_at')).toEqual([
      RETENTION.auditEventsMonths,
      'months',
    ]);
    expect(purgeInterval('error_events', 'created_at')).toEqual([
      RETENTION.errorEventsDays,
      'days',
    ]);
    expect(purgeInterval('usage_events', 'ts')).toEqual([
      RETENTION.usageEventsMonths,
      'months',
    ]);
  });

  it('keeps the rate-limit constant equal to its existing 2-day job', () => {
    const hardening = read('20261030000000_security_hardening.sql');
    expect(purgeInterval('rate_limit_counters', 'window_start', hardening)).toEqual([
      RETENTION.rateLimitCountersDays,
      'days',
    ]);
  });

  it('schedules purge-expired-records daily behind a pg_cron guard that only warns', () => {
    expect(sql).toMatch(/IF EXISTS \(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'\)/);
    expect(sql).toMatch(
      /cron\.schedule\(\s*'purge-expired-records',\s*'37 3 \* \* \*',\s*'SELECT public\.purge_expired_records\(\)'\s*\)/,
    );
    expect(sql).toMatch(/RAISE WARNING 'cron\.schedule failed/);
    expect(sql).toMatch(/RAISE WARNING 'pg_cron unavailable/);
  });

  it('does not touch the existing rate-limit job', () => {
    expect(sql).not.toContain('purge-rate-limit-counters');
  });
});

describe('scripts/sql/smoke.sql', () => {
  it('fails CI when pg_cron is installed but purge-expired-records is not scheduled', () => {
    const smoke = readFileSync(join(__dirname, '../../scripts/sql/smoke.sql'), 'utf8');
    expect(smoke).toMatch(/jobname = 'purge-expired-records'/);
  });
});
