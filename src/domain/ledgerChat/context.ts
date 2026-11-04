// Everything a tool needs to answer, loaded once per turn by the route.
// Discreet users get brand names aliased and notes dropped HERE, before any
// tool runs, so nothing user-identifying about brands or notes can reach the
// model. This is the one deliberate exception to "mask at the render site":
// the render site for this data is a third party.

import type { CigaretteLog, Goal, UserProfile } from '@/types';
import type { DailySummaryRow } from '@/domain/periodSummary';
import { brandAlias } from '@/lib/discreet';
import { NOTE_MAX_CHARS, TEXT_FIELD_MAX_CHARS } from './types';
import { localeForCountry, timezoneForCountry, type CurrencyCode } from '@/lib/regions';

export interface ToolContext {
  /** YYYY-MM-DD in the user's zone. */
  today: string;
  timezone: string;
  currency: CurrencyCode;
  locale: string;
  baselinePerDay: number | null;
  /** First day the daily summary covers: max(onboarded day, today − 365), as on Home. */
  summarySinceYmd: string;
  discreet: boolean;
  logs: CigaretteLog[];
  rows: DailySummaryRow[];
  /** Active goals, for goal_status. */
  goals: Goal[];
  /** Every goal, whatever its status, for goal_history. */
  goalHistory: Goal[];
}

export interface BuildToolContextInput {
  profile: UserProfile;
  logs: CigaretteLog[];
  rows: DailySummaryRow[];
  goals: Goal[];
  goalHistory?: Goal[];
  today: string;
  summarySinceYmd: string;
}

/** Control characters become spaces, then trim and cap: stored text is unconstrained (no DB length CHECK). */
export function cleanText(text: string, max: number = TEXT_FIELD_MAX_CHARS): string {
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

/**
 * New log objects whose free-text fields are bounded, so one huge or hostile
 * value cannot bloat every model call or smuggle instruction text. Done here,
 * once, so every tool (and the guard's name list) sees the same bounded text.
 * Empty-after-cleaning becomes null, which is what the tools already treat as absent.
 */
function boundLogText(logs: readonly CigaretteLog[]): CigaretteLog[] {
  const bound = (s: string | null, max?: number): string | null => (s ? cleanText(s, max) || null : null);
  return logs.map((l) => ({
    ...l,
    brandNameSnap: bound(l.brandNameSnap),
    variantSnap: bound(l.variantSnap),
    // Tags are typed unions in the app but the DB does not enforce them.
    triggerTag: bound(l.triggerTag) as CigaretteLog['triggerTag'],
    moodBefore: bound(l.moodBefore) as CigaretteLog['moodBefore'],
    moodAfter: bound(l.moodAfter) as CigaretteLog['moodAfter'],
    contextTag: bound(l.contextTag) as CigaretteLog['contextTag'],
    notes: bound(l.notes, NOTE_MAX_CHARS),
  }));
}

/** New log objects with brands aliased by first-seen order and free text removed. */
export function aliasLogsForDiscreet(logs: readonly CigaretteLog[]): CigaretteLog[] {
  const aliases = new Map<string, string>();
  const alias = (name: string | null): string | null => {
    if (!name) return null;
    if (!aliases.has(name)) aliases.set(name, brandAlias(aliases.size));
    return aliases.get(name) ?? null;
  };
  return logs.map((log) => ({ ...log, brandNameSnap: alias(log.brandNameSnap), variantSnap: null, notes: null }));
}

/**
 * The only profile fields the chat may see. Identity (name, birth date, gender,
 * phone, place, email) is left out structurally: buildToolContext copies these
 * keys and nothing else, and ledgerChatContext.test.ts fails if a value leaks.
 */
export const CONTEXT_PROFILE_FIELDS = ['country', 'currency', 'baselinePerDay', 'discreetMode'] as const;

type ContextProfile = Pick<UserProfile, (typeof CONTEXT_PROFILE_FIELDS)[number]>;

function pickProfile(source: UserProfile): ContextProfile {
  return Object.fromEntries(CONTEXT_PROFILE_FIELDS.map((key) => [key, source[key]])) as ContextProfile;
}

export function buildToolContext(input: BuildToolContextInput): ToolContext {
  const profile = pickProfile(input.profile);
  const discreet = profile.discreetMode;
  const logs = boundLogText(input.logs);
  return {
    today: input.today,
    timezone: timezoneForCountry(profile.country),
    currency: profile.currency,
    locale: localeForCountry(profile.country),
    baselinePerDay: profile.baselinePerDay,
    summarySinceYmd: input.summarySinceYmd,
    discreet,
    logs: discreet ? aliasLogsForDiscreet(logs) : logs,
    rows: input.rows,
    goals: input.goals,
    goalHistory: input.goalHistory ?? [],
  };
}
