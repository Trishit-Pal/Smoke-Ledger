/**
 * EU ledger: screens must hand the reader's zone to the time helpers, which
 * default to IST. Without it a Paris user's backdated "22:00" was stored as
 * 16:30 UTC and every log time rendered as an Indian clock time.
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (rel: string): string =>
  fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');

describe('screens pass the ledger zone to the time helpers', () => {
  it('the new-log form gives the backdate picker the ledger zone', () => {
    expect(read('web/app/(app)/log/new/LogNewClient.tsx')).toMatch(
      /<BackdateTimeField[^>]*zone=\{timezoneForCountry\(country\)\}/,
    );
  });

  it.each(['web/app/(app)/history/HistoryClient.tsx'])(
    '%s formats log times in the ledger zone',
    (file) => {
      const source = read(file);
      expect(source).toContain('formatTime(log.tsUtc, zone)');
      expect(source).not.toMatch(/formatTime\(log\.tsUtc\)/);
    },
  );

  it('the backdate picker never hard-codes IST', () => {
    const picker = read('web/app/(app)/log/new/BackdateTimeField.tsx');
    expect(picker).not.toMatch(/DatetimeLocalIst|Times in IST/);
  });
});
