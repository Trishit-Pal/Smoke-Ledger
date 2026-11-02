import { describe, expect, test } from 'vitest';
import {
  dismissFirstSuggestion,
  isFirstSuggestionDismissed,
} from '../lib/goals/firstSuggestionStore';

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
