// Everything a tool needs to answer, loaded once per turn by the route.
// Discreet users get brand names aliased and notes dropped HERE, before any
// tool runs, so nothing user-identifying about brands or notes can reach the
// model. This is the one deliberate exception to "mask at the render site":
// the render site for this data is a third party.

import type { CigaretteLog, Goal, UserProfile } from '@/types';
import type { DailySummaryRow } from '@/domain/periodSummary';
import { brandAlias } from '@/lib/discreet';
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
  goals: Goal[];
}

export interface BuildToolContextInput {
  profile: UserProfile;
  logs: CigaretteLog[];
  rows: DailySummaryRow[];
  goals: Goal[];
  today: string;
  summarySinceYmd: string;
}

/** New log objects with brands aliased by first-seen order and free text removed. */
export function aliasLogsForDiscreet(logs: readonly CigaretteLog[]): CigaretteLog[] {
  const aliases = new Map<string, string>();
  return logs.map((log) => {
    let brandNameSnap: string | null = null;
    if (log.brandNameSnap) {
      const existing = aliases.get(log.brandNameSnap);
      if (existing) {
        brandNameSnap = existing;
      } else {
        brandNameSnap = brandAlias(aliases.size);
        aliases.set(log.brandNameSnap, brandNameSnap);
      }
    }
    return { ...log, brandNameSnap, variantSnap: null, notes: null };
  });
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
  return {
    today: input.today,
    timezone: timezoneForCountry(profile.country),
    currency: profile.currency,
    locale: localeForCountry(profile.country),
    baselinePerDay: profile.baselinePerDay,
    summarySinceYmd: input.summarySinceYmd,
    discreet,
    logs: discreet ? aliasLogsForDiscreet(input.logs) : input.logs,
    rows: input.rows,
    goals: input.goals,
  };
}
