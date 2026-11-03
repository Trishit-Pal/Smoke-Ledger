import { newestFunction } from './helpers/newestMigrationFunction';

const NAME = '20261104100000_erase_auth_metadata.sql';

// Later migrations copy erase_account_data forward, so these checks follow the
// newest definition: a copy that drops one of Task 1's fixes fails here.
describe(`erase_account_data (introduced by ${NAME})`, () => {
  const { file, body: erase } = newestFunction('erase_account_data');

  it('is defined at or after the auth-metadata migration', () => {
    expect(file >= NAME).toBe(true);
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
