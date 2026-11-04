import { describe, expect, test } from 'vitest';
import {
  TRANSCRIPT_MAX_TURNS,
  clearTranscript,
  loadTranscript,
  saveTranscript,
  transcriptClearCount,
  type TranscriptTurn,
} from '@web/components/chat/transcriptStore';

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

function turn(i: number): TranscriptTurn {
  return { id: `t${i}`, question: `q${i}`, answer: `a${i}`, rows: [], at: '2026-06-21T00:00:00.000Z' };
}

describe('transcriptStore', () => {
  test('round-trips a transcript per user', () => {
    const store = fakeStorage();
    saveTranscript('u1', [turn(1)], store);
    expect(loadTranscript('u1', store)).toEqual([turn(1)]);
    expect(loadTranscript('u2', store)).toEqual([]);
  });

  test('keeps only the most recent turns', () => {
    const store = fakeStorage();
    const many = Array.from({ length: TRANSCRIPT_MAX_TURNS + 5 }, (_, i) => turn(i));
    const kept = saveTranscript('u1', many, store);
    expect(kept).toHaveLength(TRANSCRIPT_MAX_TURNS);
    expect(kept[0].id).toBe(`t5`);
  });

  test('clearTranscript without a user removes every chat transcript and nothing else', () => {
    const store = fakeStorage();
    store.setItem('theme', 'dark');
    saveTranscript('u1', [turn(1)], store);
    saveTranscript('u2', [turn(2)], store);
    clearTranscript(undefined, store);
    expect(loadTranscript('u1', store)).toEqual([]);
    expect(loadTranscript('u2', store)).toEqual([]);
    expect(store.getItem('theme')).toBe('dark');
  });

  test('every clear moves the clear count, so a late answer can tell it was cleared', () => {
    const store = fakeStorage();
    const before = transcriptClearCount();
    saveTranscript('u1', [turn(1)], store);
    expect(transcriptClearCount()).toBe(before);
    clearTranscript('u1', store);
    expect(transcriptClearCount()).toBe(before + 1);
    clearTranscript(undefined, store);
    expect(transcriptClearCount()).toBe(before + 2);
    // Nothing to clear (no storage) is still a clear request: the count moves.
    clearTranscript(undefined, null);
    expect(transcriptClearCount()).toBe(before + 3);
  });

  test('ignores a corrupt entry instead of throwing', () => {
    const store = fakeStorage();
    store.setItem('ledger-chat:v1:u1', '{not json');
    expect(loadTranscript('u1', store)).toEqual([]);
  });

  test('drops entries that do not have the turn shape, keeping the valid ones', () => {
    const store = fakeStorage();
    store.setItem('ledger-chat:v1:u1', JSON.stringify([{}, { id: 1 }, turn(7), { ...turn(8), rows: 'nope' }]));
    expect(loadTranscript('u1', store)).toEqual([turn(7)]);
  });
});
