/*
 * Character mood bus — typed window CustomEvent dispatcher.
 *
 * Why a window event bus (not React context):
 *   - Zero coupling. Existing components (DashboardClient, QuickLogStrip,
 *     log/new actions, logout handlers) can fire a mood without importing a
 *     provider or threading props.
 *   - No re-renders of unrelated trees. Only the <CharacterCompanion> listens.
 *   - Works across server-action boundaries: after a router.refresh() the
 *     consumer fires a mood synchronously while waiting for the refetch.
 *
 * Usage:
 *   import { dispatchMood } from '@web/lib/character/mood';
 *   dispatchMood('regret', { caption: 'Noted. No judgment.' });
 *
 *   // for streak milestones, include `celebrate: true` to fire confetti:
 *   dispatchMood('applaud', { caption: '7-day streak.', celebrate: true });
 *
 * The companion auto-returns to the resting `greet` mood after `durationMs`
 * (default 3200) so callers don't need to "clear" anything.
 */

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
  /** Optional caption flashed in the masthead under the headline. */
  caption?: string;
  /** Fire a one-shot paper-fleck confetti burst behind the figure. */
  celebrate?: boolean;
}

export interface MilestoneEventDetail {
  /** Type of milestone: 'streak' (default) or 'birthday'. */
  type?: 'streak' | 'birthday';
  /** Days under baseline, e.g. 1, 3, 7, 14, 30. */
  days: number;
  /** Headline shown in the milestone modal. */
  title: string;
  /** Supporting copy. */
  body?: string;
}

function safeDispatch<T>(name: string, detail: T): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<T>(name, { detail }));
}

export function dispatchMood(mood: Mood, opts: Omit<MoodEventDetail, 'mood'> = {}): void {
  safeDispatch<MoodEventDetail>(CHARACTER_MOOD_EVENT, { mood, ...opts });
}

/** Fire a full streak-milestone modal celebration. The companion in the
 *  masthead receives an `applaud` mood in parallel via the modal's effect. */
export function dispatchMilestone(detail: MilestoneEventDetail): void {
  safeDispatch<MilestoneEventDetail>(CHARACTER_MILESTONE_EVENT, detail);
}

/** Fire the logout farewell overlay. */
export function dispatchFarewell(): void {
  safeDispatch<void>(CHARACTER_FAREWELL_EVENT, undefined as unknown as void);
}

/* ─────────────────────────────────────────────────────────────────────
   Streak helpers — call from DashboardClient when streak changes so the
   right milestone copy is fired. Centralised here so milestone tiers
   stay consistent.
   ───────────────────────────────────────────────────────────────────── */
const MILESTONE_TIERS: ReadonlyArray<{ days: number; title: string; body: string }> = [
  { days: 1,  title: 'One day, quieter.',     body: 'The first day under your baseline is the hardest. You took it.' },
  { days: 3,  title: 'Three days, quieter.',  body: 'A small rhythm is forming. Keep noticing what helped.' },
  { days: 7,  title: 'Seven days, quieter.',  body: 'A full week under your baseline. The ledger keeps the receipt; you keep the wins.' },
  { days: 14, title: 'Two weeks, quieter.',   body: 'Fourteen days. Your body has already started repaying you.' },
  { days: 30, title: 'A month, quieter.',     body: 'Thirty days. This is no longer a streak — it is a habit.' },
];

export function milestoneForStreak(days: number): MilestoneEventDetail | null {
  const tier = MILESTONE_TIERS.find((m) => m.days === days);
  return tier ? { ...tier, type: 'streak' as const } : null;
}
