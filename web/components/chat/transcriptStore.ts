// The conversation lives on this device only: localStorage, one key per user,
// the most recent turns. Cleared on sign-out and when consent is turned off.
// Nothing here ever reaches the server.

import type { Row } from '@/domain/ledgerChat/types';

export interface TranscriptTurn {
  id: string;
  question: string;
  answer: string;
  rows: Row[];
  /** ISO timestamp. */
  at: string;
}

const KEY_PREFIX = 'ledger-chat:v1:';
export const TRANSCRIPT_MAX_TURNS = 20;

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/** Only entries with the full turn shape are trusted; anything else is dropped, never thrown on. */
function isTurn(value: unknown): value is TranscriptTurn {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.question === 'string' &&
    typeof v.answer === 'string' &&
    Array.isArray(v.rows) &&
    typeof v.at === 'string'
  );
}

export function loadTranscript(userId: string, store: Storage | null = defaultStorage()): TranscriptTurn[] {
  if (!store) return [];
  try {
    const raw = store.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTurn) : [];
  } catch {
    return [];
  }
}

/** Persists the most recent turns and returns what was kept. */
export function saveTranscript(
  userId: string,
  turns: readonly TranscriptTurn[],
  store: Storage | null = defaultStorage(),
): TranscriptTurn[] {
  const kept = turns.slice(-TRANSCRIPT_MAX_TURNS);
  try {
    store?.setItem(keyFor(userId), JSON.stringify(kept));
  } catch {
    // Quota or private mode: the conversation simply does not persist.
  }
  return kept;
}

/** One user's transcript, or every chat transcript on the device when no user is given. */
export function clearTranscript(userId?: string, store: Storage | null = defaultStorage()): void {
  if (!store) return;
  if (userId) {
    store.removeItem(keyFor(userId));
    return;
  }
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
  }
  keys.forEach((k) => store.removeItem(k));
}
