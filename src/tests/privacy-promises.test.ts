/**
 * Every "Our data promises" line on the privacy page names a mechanism, and each
 * mechanism has a checker here that reads the code that keeps the promise. A
 * promise added without a checker, or a mechanism removed, fails this file.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_PROMISES, type DataPromiseKey } from '@/lib/privacy/promises';
import { newestFunction } from './helpers/newestMigrationFunction';

const ROOT = join(__dirname, '../..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const TRACKING_PACKAGES = /firebase|segment|mixpanel|amplitude|posthog|google-analytics|react-ga|gtag|facebook|fbsdk|appsflyer|adjust|branch|admob|google-mobile-ads|@vercel\/analytics|hotjar|clarity/i;

/** Every migration in apply order, so a later file that undoes a protection is seen. */
const MIGRATIONS = readdirSync(join(ROOT, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => read(`supabase/migrations/${f}`));
const ALL_MIGRATIONS = MIGRATIONS.join(' ');

/** Tables holding the ledger and profile: each must end with RLS on and only own-row policies. */
const OWN_ROW_TABLES = [
  'cigarette_logs',
  'brands',
  'brand_variants',
  'goals',
  'reminders',
  'settings_kv',
  'price_entries',
  'user_profiles',
  'user_facts_seen',
];

/** Replays RLS switches and CREATE / ALTER / DROP POLICY across all migrations. */
function finalRlsState(): Map<string, { rls: boolean; policies: Map<string, string> }> {
  const state = new Map(OWN_ROW_TABLES.map((t) => [t, { rls: false, policies: new Map<string, string>() }]));
  for (const statement of ALL_MIGRATIONS.split(';')) {
    const rls = statement.match(/ALTER TABLE (?:ONLY )?public\.(\w+)\s+(ENABLE|DISABLE) ROW LEVEL SECURITY/i);
    if (rls && state.has(rls[1])) state.get(rls[1])!.rls = rls[2].toUpperCase() === 'ENABLE';
    const drop = statement.match(/DROP POLICY (?:IF EXISTS )?(\w+)\s+ON public\.(\w+)/i);
    if (drop && state.has(drop[2])) state.get(drop[2])!.policies.delete(drop[1]);
    const upsert = statement.match(/(?:CREATE|ALTER) POLICY (\w+)\s+ON public\.(\w+)/i);
    if (upsert && state.has(upsert[2])) {
      const policies = state.get(upsert[2])!.policies;
      // ALTER POLICY keeps the old clauses it does not mention.
      policies.set(upsert[1], `${policies.get(upsert[1]) ?? ''} ${statement}`);
    }
  }
  return state;
}

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
    // track() returns before the insert unless the reader has opted in.
    const analytics = read('src/services/analytics.ts');
    const gate = analytics.indexOf('if (!consent) return;');
    expect(gate).toBeGreaterThan(analytics.indexOf('await hasAnalyticsConsent(user.id)'));
    expect(gate).toBeLessThan(analytics.indexOf(".from('usage_events').insert("));
    for (const rel of ['web/app/(app)/settings/SettingsClient.tsx', 'app/(tabs)/settings.tsx']) {
      expect(read(rel)).toMatch(/await saveAnalyticsOptIn\(value\)/);
    }
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
    // Mobile keeps the conversation in component state only: the Ask screen and
    // its turn view touch no device storage and no settings table.
    for (const rel of ['app/ask.tsx', 'src/components/ask/AskTurn.tsx']) {
      expect(read(rel)).not.toMatch(/AsyncStorage|SecureStore|secureStore|localStorage|repositories\/settings/);
    }
    expect(read('app/ask.tsx')).toMatch(/useState<AskTurnData\[\]>\(\[\]\)/);
  },
  eraseEverywhere: () => {
    const { body } = newestFunction('erase_account_data');
    expect(body).toMatch(/DELETE FROM public\.cigarette_logs\s+WHERE user_id = uid;/);
    expect(body).toMatch(/raw_user_meta_data - 'full_name' - 'date_of_birth' - 'gender'/);
    expect(body).toMatch(/full_name\s+= NULL/);
    // Nothing personal survives on the profile row: the 30-day mobile lock and an old erase stamp go too.
    expect(body).toMatch(/mobile_changed_at\s+= NULL/);
    expect(body).toMatch(/deleted_at\s+= NULL/);
  },
  deleteRemovesIdentity: () => {
    const fn = read('supabase/functions/delete-account/index.ts');
    const erase = fn.indexOf("rpc('erase_account_data')");
    expect(erase).toBeGreaterThan(-1);
    expect(erase).toBeLessThan(fn.indexOf('auth.admin.deleteUser(userId)'));
  },
  fixedRetention: () => {
    const { body } = newestFunction('purge_expired_records');
    for (const table of ['audit_events', 'error_events', 'usage_events']) {
      expect(body).toContain(`DELETE FROM public.${table}`);
    }
    const all = ALL_MIGRATIONS;
    expect(all).toMatch(/cron\.schedule\(\s*'purge-expired-records'/);
    expect(all).not.toMatch(/cron\.unschedule\(\s*'purge-expired-records'/);
    expect(all).not.toMatch(/DROP FUNCTION (IF EXISTS )?public\.purge_expired_records/);
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
    for (const [table, { rls, policies }] of finalRlsState()) {
      expect({ table, rls }).toEqual({ table, rls: true });
      expect({ table, policies: policies.size > 0 }).toEqual({ table, policies: true });
      for (const [name, sql] of policies) {
        expect({ table, name, ownRow: /auth\.uid\s*\(\s*\)/.test(sql) }).toEqual({ table, name, ownRow: true });
        expect({ table, name, sql }).not.toEqual(expect.objectContaining({ sql: expect.stringMatching(/\(\s*true\s*\)/i) }));
      }
    }
  },
  adultsOnly: () => {
    expect(read('src/domain/age.ts')).toMatch(/export const MIN_AGE = 18;/);
    expect(newestFunction('enforce_profile_identity_rules').body).toMatch(/RAISE EXCEPTION 'underage'/);
    expect(newestFunction('handle_new_user').body).toMatch(/RAISE EXCEPTION 'underage_signup'/);
    // The triggers that run those functions must not be dropped without being recreated.
    const all = ALL_MIGRATIONS;
    for (const trigger of ['trg_user_profiles_identity_rules', 'on_auth_user_created']) {
      expect(all.lastIndexOf(`CREATE TRIGGER ${trigger}`)).toBeGreaterThan(all.lastIndexOf(`DROP TRIGGER IF EXISTS ${trigger}`));
    }
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
