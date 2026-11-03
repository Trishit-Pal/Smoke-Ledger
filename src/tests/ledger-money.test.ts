/**
 * EU ledger, mobile: native screens formatted every amount with formatInr, so
 * a user who chose France on web saw "₹13.5" on their phone, and the native
 * price editor showed ₹ and rounded €13.50 to 14.
 */
jest.mock('@/db/repositories/logs', () => ({}));
jest.mock('@/db/repositories/summary', () => ({}));
jest.mock('@/db/repositories/brands', () => ({}));
jest.mock('@/db/repositories/goals', () => ({}));
jest.mock('@/db/repositories/profile', () => ({}));
jest.mock('@/lib/catalogSync', () => ({ maybeSyncDefaultBrandCatalog: jest.fn() }));
jest.mock('@/lib/catalogStorageNative', () => ({ makeNativeCatalogStorage: jest.fn() }));
jest.mock('@/services/analytics', () => ({ track: jest.fn() }));

import { ledgerCurrency, ledgerMoney } from '@/lib/ledgerMoney';
import { useSession } from '@/store/session';
import type { UserProfile } from '@/types';

const setCountry = (country: string | null) =>
  useSession.setState({ profile: { country } as unknown as UserProfile });

describe('ledgerMoney', () => {
  it('formats in euros for an EU ledger', () => {
    setCountry('FR');
    expect(ledgerCurrency()).toBe('EUR');
    expect(ledgerMoney(13.5)).toMatch(/13,50\s?€/);
  });

  it('formats in rupees for an account with no country', () => {
    setCountry(null);
    expect(ledgerCurrency()).toBe('INR');
    expect(ledgerMoney(1234)).toBe('₹1,234');
  });

  it('keeps the em dash for a missing amount', () => {
    setCountry('FR');
    expect(ledgerMoney(null)).toBe('—');
  });
});

describe('native screens format money for the ledger', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs');
  const path = jest.requireActual<typeof import('path')>('path');
  const read = (f: string) => fs.readFileSync(path.resolve(__dirname, '../..', f), 'utf8');

  it.each([
    'app/(tabs)/index.tsx',
    'app/(tabs)/history.tsx',
    'app/(tabs)/log.tsx',
    'app/(tabs)/trends.tsx',
    'app/(tabs)/settings.tsx',
  ])('%s never calls formatInr', (file) => {
    expect(read(file)).not.toMatch(/formatInr\(/);
  });

  it('the native price editor shows the ledger currency and keeps cents', () => {
    const settings = read('app/(tabs)/settings.tsx');
    expect(settings).not.toMatch(/Avg price \(₹\)/);
    expect(settings).not.toMatch(/`₹\$\{Math\.round\(v\.avgPriceInr\)\}`/);
  });
});
