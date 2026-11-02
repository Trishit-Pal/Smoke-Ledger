/**
 * EU ledger, mobile: every native log goes through useSession.addLog, and none
 * of its callers passed a timeZone, so createLog fell back to IST and a French
 * user's phone logs landed on Indian dates and hours. addLog now fills the
 * zone from the profile's country (IST when there is none).
 */
jest.mock('@/db/repositories/logs', () => ({ createLog: jest.fn() }));
jest.mock('@/db/repositories/summary', () => ({ getDailySummary: jest.fn().mockResolvedValue([]) }));
jest.mock('@/db/repositories/brands', () => ({}));
jest.mock('@/db/repositories/goals', () => ({}));
jest.mock('@/db/repositories/profile', () => ({}));
jest.mock('@/lib/catalogSync', () => ({ maybeSyncDefaultBrandCatalog: jest.fn() }));
jest.mock('@/lib/catalogStorageNative', () => ({ makeNativeCatalogStorage: jest.fn() }));
jest.mock('@/services/analytics', () => ({ track: jest.fn() }));

import * as logsRepo from '@/db/repositories/logs';
import { useSession, ledgerToday, ledgerDaysAgo } from '@/store/session';
import type { UserProfile } from '@/types';

const createLog = logsRepo.createLog as jest.Mock;
const draft = { brandId: 'b1', quantity: 1 } as unknown as Parameters<typeof logsRepo.createLog>[0];

describe('useSession.addLog', () => {
  beforeEach(() => {
    createLog.mockReset().mockResolvedValue({ id: 'log_1' });
  });

  it('logs in the profile country zone', async () => {
    useSession.setState({ profile: { country: 'FR' } as UserProfile, logs: [] });
    await useSession.getState().addLog(draft);
    expect(createLog).toHaveBeenCalledWith(expect.objectContaining({ timeZone: 'Europe/Paris' }));
  });

  it('logs in IST for an account with no country', async () => {
    useSession.setState({ profile: { country: null } as unknown as UserProfile, logs: [] });
    await useSession.getState().addLog(draft);
    expect(createLog).toHaveBeenCalledWith(expect.objectContaining({ timeZone: 'Asia/Kolkata' }));
  });

  it('keeps a zone the caller passed explicitly', async () => {
    useSession.setState({ profile: { country: 'FR' } as UserProfile, logs: [] });
    await useSession.getState().addLog({ ...draft, timeZone: 'Europe/Berlin' });
    expect(createLog).toHaveBeenCalledWith(expect.objectContaining({ timeZone: 'Europe/Berlin' }));
  });
});

// Logs carry the ledger-zone date, so "today" must be read in the same zone:
// 21:00 in Paris on 31 Oct is already 1 Nov in India.
describe('ledgerToday / ledgerDaysAgo', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-31T20:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('reads today in the profile country zone', () => {
    useSession.setState({ profile: { country: 'FR' } as UserProfile });
    expect(ledgerToday()).toBe('2026-10-31');
    expect(ledgerDaysAgo(1)).toBe('2026-10-30');
  });

  it('reads today in IST for an account with no country', () => {
    useSession.setState({ profile: { country: null } as unknown as UserProfile });
    expect(ledgerToday()).toBe('2026-11-01');
    expect(ledgerDaysAgo(1)).toBe('2026-10-31');
  });
});

describe('native screens read today in the ledger zone', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs');
  const path = jest.requireActual<typeof import('path')>('path');

  it.each([
    'app/(tabs)/index.tsx',
    'app/(tabs)/log.tsx',
    'app/(tabs)/history.tsx',
    'app/(tabs)/trends.tsx',
    'app/(tabs)/goals.tsx',
    'app/goals/new.tsx',
  ])('%s', (file) => {
    const source = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
    expect(source).not.toMatch(/\b(todayIst|daysAgoIst)\b/);
  });
});

// The native screens call createLog directly (not through addLog), so each call
// site must pass the ledger zone too.
describe('native screens log in the ledger zone', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs');
  const path = jest.requireActual<typeof import('path')>('path');

  it.each(['app/(tabs)/index.tsx', 'app/(tabs)/log.tsx', 'app/log/new.tsx'])('%s', (file) => {
    const source = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
    const calls = source.split('createLog({').slice(1);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call.slice(0, 600)).toContain('timeZone: ledgerTimeZone()');
  });
});
