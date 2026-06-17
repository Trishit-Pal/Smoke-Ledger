// Character mood bus (RN port of web/lib/character/mood.ts).
//
// Uses React Native's DeviceEventEmitter as a tiny in-memory event bus so
// any screen can dispatch a mood/milestone/farewell without props or context,
// and the resident <CharacterCompanion>, <MilestoneCelebration>, and
// <LogoutFarewell> listeners react globally. Same event-shape and tier copy
// as the web for cross-platform parity.

import { DeviceEventEmitter, type EmitterSubscription } from 'react-native';

export type Mood =
  | 'greet'
  | 'regret'
  | 'thumb'
  | 'applaud'
  | 'victory'
  | 'breathe'
  | 'concern'
  | 'bye';

export const CHARACTER_MOOD_EVENT = 'character:mood';
export const CHARACTER_FAREWELL_EVENT = 'character:farewell';
export const CHARACTER_MILESTONE_EVENT = 'character:milestone';

export interface MoodEventDetail {
  mood: Mood;
  /** How long the non-resting mood holds before easing back to `greet`. */
  durationMs?: number;
  /** Optional caption flashed under the figure. */
  caption?: string;
  /** Fire a one-shot paper-fleck confetti burst behind the figure. */
  celebrate?: boolean;
}

export interface MilestoneEventDetail {
  /** Type of milestone: 'streak' (default) or 'birthday'. */
  type?: 'streak' | 'birthday';
  /** Days under baseline, e.g. 1, 3, 7, 14, 30. Used if type is 'streak'. */
  days: number;
  /** Headline shown in the milestone modal. */
  title: string;
  /** Supporting copy. */
  body?: string;
}

export function dispatchMood(
  mood: Mood,
  opts: Omit<MoodEventDetail, 'mood'> = {},
): void {
  DeviceEventEmitter.emit(CHARACTER_MOOD_EVENT, { mood, ...opts } satisfies MoodEventDetail);
}

/** Fires a full streak-milestone modal celebration. The masthead companion
 *  receives an `applaud` mood in parallel via the modal's effect. */
export function dispatchMilestone(detail: MilestoneEventDetail): void {
  DeviceEventEmitter.emit(CHARACTER_MILESTONE_EVENT, detail);
}

/** Fires the logout farewell overlay. */
export function dispatchFarewell(): void {
  DeviceEventEmitter.emit(CHARACTER_FAREWELL_EVENT);
}

/** Convenience subscriber helpers — listeners get one-arg `detail`. */
export function onMood(handler: (detail: MoodEventDetail) => void): EmitterSubscription {
  return DeviceEventEmitter.addListener(CHARACTER_MOOD_EVENT, handler);
}

export function onMilestone(handler: (detail: MilestoneEventDetail) => void): EmitterSubscription {
  return DeviceEventEmitter.addListener(CHARACTER_MILESTONE_EVENT, handler);
}

export function onFarewell(handler: () => void): EmitterSubscription {
  return DeviceEventEmitter.addListener(CHARACTER_FAREWELL_EVENT, handler);
}

// ── Streak milestone tiers — mirrors web/lib/character/mood.ts MILESTONE_TIERS ──
const MILESTONE_TIERS: ReadonlyArray<MilestoneEventDetail> = [
  { days: 1,  title: 'One day, quieter.',    body: 'The first day under your baseline is the hardest. You took it.' },
  { days: 3,  title: 'Three days, quieter.', body: 'A small rhythm is forming. Keep noticing what helped.' },
  { days: 7,  title: 'Seven days, quieter.', body: 'A full week under your baseline. The ledger keeps the receipt; you keep the wins.' },
  { days: 14, title: 'Two weeks, quieter.',  body: 'Fourteen days. Your body has already started repaying you.' },
  { days: 30, title: 'A month, quieter.',    body: 'Thirty days. This is no longer a streak — it is a habit.' },
];

export function milestoneForStreak(days: number): MilestoneEventDetail | null {
  const tier = MILESTONE_TIERS.find((m) => m.days === days);
  return tier ? { ...tier } : null;
}
