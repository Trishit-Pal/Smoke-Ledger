import { describe, expect, test } from 'vitest';
import type { Proposal } from '@/domain/goalProposals';
import {
  dismissFirstSuggestion,
  isFirstSuggestionDismissed,
} from '../lib/goals/firstSuggestionStore';
import { firstSuggestionSentence, shouldShowFirstSuggestion } from '../lib/goals/firstSuggestion';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}

const proposal: Proposal = { kind: 'start', type: 'daily_cap', value: 6, unit: 'sticks', basisAvg: 7.24 };

describe('firstSuggestionStore', () => {
  test('is not dismissed until the reader says so', () => {
    expect(isFirstSuggestionDismissed('u1', '2026-11-02', fakeStorage())).toBe(false);
  });

  test('stays dismissed inside the snooze window, per user', () => {
    const store = fakeStorage();
    dismissFirstSuggestion('u1', '2026-11-02', store);
    expect(store.getItem('goals.firstSuggestion.dismissedOn:u1')).toBe('2026-11-02');
    expect(isFirstSuggestionDismissed('u1', '2026-11-02', store)).toBe(true);
    expect(isFirstSuggestionDismissed('u1', '2026-11-15', store)).toBe(true);
    expect(isFirstSuggestionDismissed('u2', '2026-11-02', store)).toBe(false);
  });

  test('comes back after the snooze window', () => {
    const store = fakeStorage();
    dismissFirstSuggestion('u1', '2026-11-02', store);
    expect(isFirstSuggestionDismissed('u1', '2026-11-16', store)).toBe(false);
  });

  test('ignores a stored value that is not a date', () => {
    const store = fakeStorage();
    store.setItem('goals.firstSuggestion.dismissedOn:u1', 'garbage');
    expect(isFirstSuggestionDismissed('u1', '2026-11-02', store)).toBe(false);
  });

  test('degrades to "not dismissed" and never throws without storage', () => {
    expect(isFirstSuggestionDismissed('u1', '2026-11-02', null)).toBe(false);
    expect(() => dismissFirstSuggestion('u1', '2026-11-02', null)).not.toThrow();
  });
});

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
