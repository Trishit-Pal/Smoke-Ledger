/**
 * Every "Our data promises" line on the privacy page names a mechanism, and each
 * mechanism has a checker here that reads the code that keeps the promise. A
 * promise added without a checker, or a mechanism removed, fails this file.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_PROMISES, type DataPromiseKey } from '@/lib/privacy/promises';
import { newestFunction } from './helpers/newestMigrationFunction';

const ROOT = join(__dirname, '../..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const TRACKING_PACKAGES = /firebase|segment|mixpanel|amplitude|posthog|google-analytics|react-ga|gtag|facebook|fbsdk|appsflyer|adjust|branch|admob|google-mobile-ads|@vercel\/analytics|hotjar|clarity/i;

function dependencyNames(rel: string): string[] {
  const pkg = JSON.parse(read(rel)) as { dependencies?: Record<string, string> };
  return Object.keys(pkg.dependencies ?? {});
}

const CHECKERS: Record<DataPromiseKey, () => void> = {
  noSaleNoAds: () => {
    for (const rel of ['package.json', 'web/package.json']) {
      expect(dependencyNames(rel).filter((name) => TRACKING_PACKAGES.test(name))).toEqual([]);
    }
  },
  analyticsOptIn: () => {
    const analytics = read('src/services/analytics.ts');
    expect(analytics).toMatch(/hasAnalyticsConsent\(/);
    expect(read('src/services/consentWithdrawal.ts')).toMatch(/rpc\('delete_my_usage_events'\)/);
    expect(newestFunction('delete_my_usage_events').body).toMatch(/DELETE FROM public\.usage_events\s+WHERE user_id = uid;/);
  },
  chatOptIn: () => {
    const route = read('web/app/api/ledger-chat/route.ts');
    const consentGate = route.indexOf("fail('consent_required', 403)");
    expect(consentGate).toBeGreaterThan(-1);
    expect(consentGate).toBeLessThan(route.indexOf('new Anthropic('));
  },
  chatNotStored: () => {
    for (const rel of ['web/app/api/ledger-chat/route.ts', 'web/lib/server/ledgerChat/turn.ts']) {
      expect(read(rel)).not.toMatch(/\.(insert|upsert|update)\(/);
    }
    expect(read('web/components/chat/transcriptStore.ts')).toMatch(/localStorage/);
  },
  eraseEverywhere: () => {
    const { body } = newestFunction('erase_account_data');
    expect(body).toMatch(/DELETE FROM public\.cigarette_logs\s+WHERE user_id = uid;/);
    expect(body).toMatch(/raw_user_meta_data - 'full_name' - 'date_of_birth' - 'gender'/);
    expect(body).toMatch(/full_name\s+= NULL/);
  },
  deleteRemovesIdentity: () => {
    const fn = read('supabase/functions/delete-account/index.ts');
    const erase = fn.indexOf("rpc('erase_account_data')");
    expect(erase).toBeGreaterThan(-1);
    expect(erase).toBeLessThan(fn.indexOf('auth.admin.deleteUser(userId)'));
  },
  fixedRetention: () => {
    const sql = read('supabase/migrations/20261104110000_retention_purge.sql');
    expect(sql).toMatch(/cron\.schedule\(/);
    for (const table of ['audit_events', 'error_events', 'usage_events']) {
      expect(sql).toContain(`DELETE FROM public.${table}`);
    }
  },
  redactedErrors: () => {
    expect(read('src/lib/logger.ts')).toMatch(/redactText\(/);
    const redact = read('supabase/functions/_shared/redact.ts');
    expect(redact).toContain("'[email]'");
    expect(redact).toContain("'[phone]'");
  },
  completeExport: () => {
    const { body } = newestFunction('export_account_data');
    for (const key of ["'account'", "'errorEvents'", "'auditEvents'", "'logs'", 'to_jsonb(p)']) {
      expect(body).toContain(key);
    }
  },
  ownRowsOnly: () => {
    expect(read('supabase/migrations/20250426120000_initial_schema.sql')).toContain(
      'ALTER TABLE public.cigarette_logs ENABLE ROW LEVEL SECURITY;',
    );
  },
  adultsOnly: () => {
    expect(read('src/domain/age.ts')).toMatch(/export const MIN_AGE = 18;/);
    expect(read('supabase/migrations/20261030000000_security_hardening.sql')).toMatch(/RAISE EXCEPTION 'underage'/);
  },
};

describe('our data promises', () => {
  it('has a mechanism checker for every promise, and no checker without a promise', () => {
    expect(DATA_PROMISES.map((p) => p.key).sort()).toEqual(Object.keys(CHECKERS).sort());
  });

  it('uses each key once', () => {
    const keys = DATA_PROMISES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  for (const key of Object.keys(CHECKERS) as DataPromiseKey[]) {
    it(`keeps "${key}" in code`, () => {
      CHECKERS[key]();
    });
  }

  it('renders the promises on the privacy page', () => {
    const page = read('web/app/privacy/page.tsx');
    expect(page).toContain("title: 'Our data promises'");
    expect(page).toMatch(/DATA_PROMISES\.map/);
  });
});
