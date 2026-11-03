import { newestFunction } from './helpers/newestMigrationFunction';

describe('newest export_account_data', () => {
  const { file, body } = newestFunction('export_account_data');

  it('is at or after the export-complete migration (later ones must copy it forward)', () => {
    expect(file >= '20261104120000_export_complete.sql').toBe(true);
  });

  it('keeps SECURITY DEFINER, an empty search_path and the auth guard', () => {
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/SET search_path = ''/);
    expect(body).toMatch(/uid uuid := auth\.uid\(\)/);
    expect(body).toMatch(/IF uid IS NULL THEN/);
  });

  it('exports the sign-in record for the caller only', () => {
    const block = body.match(/'account', \(([\s\S]*?)\n {6}\),/)?.[1] ?? '';
    expect(block).toMatch(/FROM auth\.users u/);
    expect(block).toMatch(/WHERE u\.id = uid/);
    for (const key of ['email', 'phone', 'createdAt', 'lastSignInAt']) {
      expect(block).toContain(`'${key}'`);
    }
    expect(block).not.toMatch(/raw_user_meta_data/);
  });

  it('exports the callers own error_events for the uid', () => {
    const block = body.match(/'errorEvents', \(([\s\S]*?)\n {6}\),/)?.[1] ?? '';
    expect(block).toMatch(/FROM public\.error_events ee/);
    expect(block).toMatch(/WHERE ee\.user_id = uid/);
    for (const key of ['category', 'message', 'route', 'createdAt']) {
      expect(block).toContain(`'${key}'`);
    }
  });

  it('still exports own audit rows and reports version 3', () => {
    expect(body).toMatch(/FROM public\.audit_events ae\s+WHERE ae\.user_id = uid/);
    expect(body).not.toMatch(/'version', 2/);
    expect(body).toMatch(/'version', 3/);
  });
});

describe('export covers everything erase removes', () => {
  const erase = newestFunction('erase_account_data').body;
  const exp = newestFunction('export_account_data').body;

  const erased = new Set<string>();
  for (const m of erase.matchAll(/(?:DELETE FROM|UPDATE)\s+((?:public|auth)\.\w+)/g)) {
    erased.add(m[1]);
  }

  it('finds the tables erase touches', () => {
    expect(erased.size).toBeGreaterThan(8);
    expect(erased).toContain('public.cigarette_logs');
    expect(erased).toContain('auth.users');
  });

  it.each([...erased])('export reads %s', (table) => {
    // Word boundary: `FROM public.audit_events_archive` must not satisfy `public.audit_events`.
    expect(exp).toMatch(new RegExp(String.raw`FROM ${table.replace('.', String.raw`\.`)}\b`));
  });
});
