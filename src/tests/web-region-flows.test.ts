/**
 * EU ledger region flows found in review:
 * - Onboarding started on India whatever the saved country, and called
 *   setRegion on every Continue: going Back as a French user silently switched
 *   the account to INR (or hit region_change_requires_reset with no way out).
 * - Settings kept "Reset the ledger and switch" visible after the user picked
 *   their original country again, one click from wiping the ledger.
 */
import * as fs from 'fs';
import * as path from 'path';
import { regionChangeNeeded } from '@/lib/regions';

const read = (rel: string): string =>
  fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');

describe('regionChangeNeeded', () => {
  it('treats an account with no country as India', () => {
    expect(regionChangeNeeded(null, 'IN')).toBe(false);
    expect(regionChangeNeeded(undefined, 'FR')).toBe(true);
  });

  it('is false when the pick is the saved country', () => {
    expect(regionChangeNeeded('FR', 'FR')).toBe(false);
  });

  it('is true for a different country', () => {
    expect(regionChangeNeeded('FR', 'DE')).toBe(true);
    expect(regionChangeNeeded('FR', 'IN')).toBe(true);
  });
});

describe('onboarding keeps the saved country', () => {
  const page = read('web/app/onboarding/usage/page.tsx');

  it('starts from the saved profile country, not a hard-coded India', () => {
    expect(page).not.toMatch(/useState\('IN'\)/);
    expect(page).toContain('getProfile()');
  });

  it('only calls setRegion when the country actually changes', () => {
    expect(page).toMatch(/regionChangeNeeded\(savedCountry, country\)[\s\S]{0,40}setRegion\(country\)/);
  });
});

describe('settings never leaves a stale reset prompt', () => {
  it('changing the country clears the reset confirmation', () => {
    expect(read('web/app/(app)/settings/SettingsClient.tsx')).toMatch(
      /<CountryField[^>]*onChange=\{\(next\) => \{\s*setCountry\(next\);\s*setConfirmRegionReset\(false\);/,
    );
  });
});
