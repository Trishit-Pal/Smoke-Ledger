import type { UserProfile } from '@/types';

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

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Distinct stand-in for the nth brand: "Brand A".."Brand Z", then "Brand 27"… */
export function brandAlias(index: number): string {
  if (!Number.isInteger(index) || index < 0) return 'Brand hidden';
  return index < ALPHABET.length ? `Brand ${ALPHABET[index]}` : `Brand ${index + 1}`;
}

/** Brand at list position `index`: its own alias when discreet, so rows stay distinct. */
export function maskBrandAt(name: string | null | undefined, index: number, discreet: boolean): string {
  if (!name) return '—';
  return discreet ? brandAlias(index) : name;
}

/** Home "last entry" label. Discreet hides the variant too: it can identify the brand. */
export function lastEntryLabel(
  brand: string | null | undefined,
  variant: string | null | undefined,
  discreet: boolean,
): string {
  const name = maskBrandName(brand ?? 'Unknown', discreet);
  return variant && !discreet ? `${name} · ${variant}` : name;
}

export function maskNotes(notes: string | null | undefined, discreet: boolean): string | null {
  if (!notes) return null;
  return discreet ? 'Hidden in discreet mode' : notes;
}

/** Figures inside prose (grouped, decimal, or plain; digits of any script, "५००") become '•••'; words and currency marks stay. */
const PROSE_NUMBER = /\p{Nd}+(?:[,   ]\p{Nd}{2,3})*(?:\.\p{Nd}+)?/gu;

export function maskNumbers(text: string, discreet: boolean): string {
  if (!discreet || !text) return text;
  return text.replace(PROSE_NUMBER, '•••');
}

/** Spoken form of maskNumbers: a screen reader would read '•••' as "bullet bullet bullet". */
export function spokenMask(text: string, discreet: boolean): string {
  if (!discreet || !text) return text;
  return text.replace(PROSE_NUMBER, 'hidden');
}
