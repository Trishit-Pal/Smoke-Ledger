import type { Proposal } from '@/domain/goalProposals';
import { firstSuggestionSentence, shouldShowFirstSuggestion } from '@/domain/firstSuggestion';
import { dismissFirstSuggestion, isFirstSuggestionDismissed } from '@/lib/goals/firstSuggestionStore';

const proposal: Proposal = { kind: 'start', type: 'daily_cap', value: 6, unit: 'sticks', basisAvg: 7.24 };

describe('shouldShowFirstSuggestion', () => {
  const base = { hasActiveGoal: false, proposal, dismissed: false, userKnown: true };
  test('shows with no goal, a proposal, and no dismissal', () => {
    expect(shouldShowFirstSuggestion(base)).toBe(true);
  });
  test.each([
    ['an active goal exists', { hasActiveGoal: true }],
    ['there is no proposal', { proposal: null }],
    ['it was dismissed', { dismissed: true }],
    ['the user id is not yet known', { userKnown: false }],
  ])('hides when %s', (_, patch) => {
    expect(shouldShowFirstSuggestion({ ...base, ...patch })).toBe(false);
  });
});

describe('firstSuggestionSentence', () => {
  test('states days, average and cap', () => {
    expect(firstSuggestionSentence(proposal, 12, false)).toBe(
      '12 days in the ledger. Your average is 7.2 a day — a cap at 6?',
    );
  });
  test('masks every figure when Home totals are hidden', () => {
    const s = firstSuggestionSentence(proposal, 12, true);
    expect(s).not.toMatch(/\d/);
    expect(s).toBe('•• days in the ledger. Your average is •• a day — a cap at ••?');
  });
});

function fakeAsyncStorage(opts: { failGet?: boolean; failSet?: boolean } = {}) {
  const map = new Map<string, string>();
  return {
    map,
    getItem: async (k: string) => {
      if (opts.failGet) throw new Error('boom');
      return map.get(k) ?? null;
    },
    setItem: async (k: string, v: string) => {
      if (opts.failSet) throw new Error('boom');
      map.set(k, v);
    },
  };
}

describe('mobile firstSuggestionStore (AsyncStorage)', () => {
  test('is not dismissed until the reader says so', async () => {
    expect(await isFirstSuggestionDismissed('u1', '2026-11-02', fakeAsyncStorage())).toBe(false);
  });

  test('stays dismissed inside the snooze window, per user, under the shared key', async () => {
    const store = fakeAsyncStorage();
    await dismissFirstSuggestion('u1', '2026-11-02', store);
    expect(store.map.get('goals.firstSuggestion.dismissedOn:u1')).toBe('2026-11-02');
    expect(await isFirstSuggestionDismissed('u1', '2026-11-15', store)).toBe(true);
    expect(await isFirstSuggestionDismissed('u2', '2026-11-02', store)).toBe(false);
  });

  test('comes back after the snooze window', async () => {
    const store = fakeAsyncStorage();
    await dismissFirstSuggestion('u1', '2026-11-02', store);
    expect(await isFirstSuggestionDismissed('u1', '2026-11-16', store)).toBe(false);
  });

  test('ignores a stored value that is not a date', async () => {
    const store = fakeAsyncStorage();
    store.map.set('goals.firstSuggestion.dismissedOn:u1', 'garbage');
    expect(await isFirstSuggestionDismissed('u1', '2026-11-02', store)).toBe(false);
  });

  test('never throws without storage or when storage fails', async () => {
    expect(await isFirstSuggestionDismissed('u1', '2026-11-02', null)).toBe(false);
    await expect(dismissFirstSuggestion('u1', '2026-11-02', null)).resolves.toBeUndefined();
    expect(await isFirstSuggestionDismissed('u1', '2026-11-02', fakeAsyncStorage({ failGet: true }))).toBe(false);
    await expect(dismissFirstSuggestion('u1', '2026-11-02', fakeAsyncStorage({ failSet: true }))).resolves.toBeUndefined();
  });
});
