import type { UserProfile } from '@/types';
import { FIGURE_SOURCE } from '@/lib/digits';

/** Home dashboard totals hidden (explicit toggle or full discreet mode). */
export function isHomeTotalsHidden(profile: UserProfile | null | undefined): boolean {
  return !!(profile?.hideTotalsOnHome || profile?.discreetMode);
}

/** App-wide discreet masking (numbers, brands, notes). */
export function isDiscreetMode(profile: UserProfile | null | undefined): boolean {
  return !!profile?.discreetMode;
}

export function maskCount(value: number | string, discreet: boolean): string {
  if (discreet) return '•••';
  return String(value);
}

export function maskInr(value: number | null | undefined, discreet: boolean, format: (n: number) => string): string {
  if (discreet) return '•••';
  if (value == null || !Number.isFinite(value)) return '—';
  return format(value);
}

export function maskBrandName(name: string | null | undefined, discreet: boolean): string {
  if (!name) return '—';
  return discreet ? 'Brand hidden' : name;
}

export function maskNotes(notes: string | null | undefined, discreet: boolean): string | null {
  if (!notes) return null;
  return discreet ? 'Hidden in discreet mode' : notes;
}

/**
 * Figures inside prose (grouped, decimal, or plain, in any script's digits)
 * become '•••'; words and currency marks stay. Same pattern the narration guard checks.
 */
const PROSE_NUMBER = new RegExp(FIGURE_SOURCE, 'gu');

export function maskNumbers(text: string, discreet: boolean): string {
  if (!discreet || !text) return text;
  return text.replace(PROSE_NUMBER, '•••');
}
