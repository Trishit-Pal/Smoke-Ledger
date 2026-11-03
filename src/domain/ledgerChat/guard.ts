// Output guards. The model is asked never to write numbers; this is the check
// that makes the promise hold. A figure in the narration must exist in a tool
// result, or be a time or a short duration, or it is unverified.

import type { ToolOutcome } from './tools';

export const NARRATION_MAX_CHARS = 800;

/** A clock time, or a number with optional grouping (1,200 · 1,00,000 · 1 200) and decimals. ASCII digits: run toAsciiDigits first. */
const NUMBER_TOKEN = /\d{1,2}:\d{2}|\d+(?:[,   ]\d{2,3})*(?:\.\d+)?/g;
const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
/**
 * What may follow a small integer for it to read as a time, a duration or a day of the month, not a figure.
 * ponytail: English month names, day before month only ("14 June", the en-IN and EU order).
 * "June 14", "14 juin", "14. Juni" and "14 जून" take the retry; so does the 8 in "8–14 June".
 * "14 may be…" passes, because "may" is a month. Per-language month lists if that matters.
 */
const DURATION_CONTEXT = new RegExp(
  "^(?:\\s*(?::\\d{2}|(?:am|pm|a\\.m\\.|p\\.m\\.|o'clock|days?|weeks?|months?|years?|hours?|hrs?|minutes?|mins?)\\b)" +
    `|(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTHS})\\b)`,
  'i',
);
const SMALL_INT_MAX = 31;
const COMMON_WINDOWS = new Set(['7', '30', '90', '365']);
/** An ISO date lends only its year: its month and day are small enough to pass for a made-up figure. */
const ISO_DATE = /\b(\d{4})-\d{2}-\d{2}/g;
/**
 * Fields that verify no figure: hours (hour, entryHour) are clock times, and a narrated
 * time passes by its context; notes are the reader's own free text ("had 10 with Raj"),
 * not ledger figures.
 */
const UNHARVESTED_KEY = /hour$|^notes$/i;

const UNICODE_DIGIT = /\p{Nd}/gu;
const IS_UNICODE_DIGIT = /^\p{Nd}$/u;

/**
 * Every decimal digit, in any script ("५००", "８"), as ASCII, so the checks below see it.
 * Unicode encodes each script's digits as consecutive runs of ten from zero, so a digit's
 * value is its distance from the start of its run, mod 10 (some runs sit back to back).
 */
function toAsciiDigits(text: string): string {
  return text.replace(UNICODE_DIGIT, (d) => {
    let cp = d.codePointAt(0) as number;
    let offset = 0;
    while (IS_UNICODE_DIGIT.test(String.fromCodePoint(cp - 1))) {
      cp -= 1;
      offset += 1;
    }
    return String(offset % 10);
  });
}

function normalizeToken(raw: string): string {
  const stripped = raw.replace(/[,   ]/g, '').replace(/\.$/, '');
  const n = Number(stripped);
  return Number.isFinite(n) ? String(n) : stripped;
}

function addNumber(set: Set<string>, n: number): void {
  // The value itself and its usual roundings; never floor/ceil, which would
  // let a figure one off the data pass as verified.
  const abs = Math.abs(n);
  for (const s of [String(abs), String(Math.round(abs)), abs.toFixed(1), abs.toFixed(2)]) {
    set.add(normalizeToken(s));
  }
}

function harvest(set: Set<string>, value: unknown): void {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) addNumber(set, value);
  } else if (typeof value === 'string') {
    // Strings still count (insight sentences and the context block carry figures as text),
    // but not their clock times or the month and day of a date.
    for (const m of toAsciiDigits(value).replace(ISO_DATE, '$1').match(NUMBER_TOKEN) ?? []) {
      if (m.includes(':')) continue;
      const n = Number(normalizeToken(m));
      if (Number.isFinite(n)) addNumber(set, n);
    }
  } else if (Array.isArray(value)) {
    value.forEach((v) => harvest(set, v));
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) if (!UNHARVESTED_KEY.test(key)) harvest(set, v);
  }
}

/** Every figure the model may legitimately repeat this turn. */
export function allowedNumbers(
  outcomes: readonly ToolOutcome[],
  opts: { year: string; extraText?: readonly string[] },
): Set<string> {
  const set = new Set<string>([opts.year]);
  for (const o of outcomes) {
    if (!o.ok) continue;
    harvest(set, o.data);
    harvest(set, o.rows);
  }
  for (const text of opts.extraText ?? []) harvest(set, text);
  return set;
}

function isDurationLike(norm: string, rest: string): boolean {
  if (!/^\d+$/.test(norm)) return false;
  const n = Number(norm);
  const small = n <= SMALL_INT_MAX || COMMON_WINDOWS.has(norm);
  return small && DURATION_CONTEXT.test(rest);
}

/** Digit-runs in `text` (any script, returned as ASCII) that are neither tool figures nor times, durations or days of the month. */
export function findUnverifiedNumbers(text: string, allowed: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const ascii = toAsciiDigits(text);
  const re = new RegExp(NUMBER_TOKEN.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(ascii)) !== null) {
    const raw = m[0];
    if (raw.includes(':')) continue;
    // A decimal passes only as a rounding addNumber put in the set: "18.40" is not "18".
    const norm = normalizeToken(raw);
    if (allowed.has(norm)) continue;
    if (isDurationLike(norm, ascii.slice(m.index + raw.length))) continue;
    out.push(raw);
  }
  return out;
}

// Number words (gap N2): a figure spelled out dodges the digit check above.
// "one" and "two" are everyday English ("one of", "two quiet days"), and so is
// "do" ("do you"). Outside discreet mode the Hinglish digits and "do" count only
// before a unit or a scale word, and "one", "two" and "zero" never ("zero entries
// today" is prose). Discreet mode is stricter, because the panel masks digits, not
// words: every Hinglish digit, "zero", "twice", "a couple of" and "a dozen" always count,
// and "one", "two" and "do" count before a unit ("two packs").
// English and Hinglish only: the system prompt keeps discreet replies in English (prompt.ts).
const TENS = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';
const ONES = 'one|two|three|four|five|six|seven|eight|nine';
const ENGLISH_WORDS =
  `(?:${TENS})(?:-(?:${ONES}))?|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen` +
  '|sixteen|seventeen|eighteen|nineteen|hundreds?|thousands?|lakhs?|crores?|millions?|percent|per\\s+cent';
/** Hinglish hundreds and thousands: always figures (lakh and crore are in the English list). */
const HINGLISH_SCALE = 'sau|hazaar|hazar';
const HINGLISH_DIGITS_NOT_DO = 'ek|teen|char|chaar|paanch|panch|chhe|saat|aath|nau|das';
const HINGLISH_UNIT =
  '(?=\\s+(?:sticks?|cigarettes?|cigs?|packs?|rupees?|rupaye|rupay|rupaiye|rupaiya|rupiya|rs|paise|euros?' +
  `|baar|din|ghante|${HINGLISH_SCALE}|lakhs?|crores?)\\b)`;
const ALWAYS = `\\b(?:${ENGLISH_WORDS}|${HINGLISH_SCALE})\\b`;
const NUMBER_WORD_PLAIN = new RegExp(`${ALWAYS}|\\b(?:do|${HINGLISH_DIGITS_NOT_DO})\\b${HINGLISH_UNIT}`, 'gi');
const NUMBER_WORD_DISCREET = new RegExp(
  `${ALWAYS}|\\b(?:zero|twice|a\\s+couple\\s+of|a\\s+dozen|${HINGLISH_DIGITS_NOT_DO})\\b|\\b(?:one|two|do)\\b${HINGLISH_UNIT}`,
  'gi',
);
const WORD_DURATION_CONTEXT =
  /^[\s-]*(?:days?|weeks?|months?|years?|hours?|hrs?|minutes?|mins?|o['’]clock|am|pm|a\.m\.|p\.m\.|din|ghante)(?![a-z])/i;

/**
 * Spelled-out figures in `text`. Outside discreet mode a number word followed
 * by a duration or time ("three days", "nine pm", "teen din") is allowed; in
 * discreet mode every number word is unverified. "percent" right after digits
 * is left to findUnverifiedNumbers, which checks the digits themselves.
 */
export function findUnverifiedNumberWords(text: string, opts: { discreet: boolean }): string[] {
  const out: string[] = [];
  const re = new RegExp((opts.discreet ? NUMBER_WORD_DISCREET : NUMBER_WORD_PLAIN).source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const word = m[0];
    const before = text.slice(0, m.index);
    if (/^per/i.test(word) && /\p{Nd}\s*$/u.test(before)) continue;
    if (!opts.discreet && WORD_DURATION_CONTEXT.test(text.slice(m.index + word.length))) continue;
    out.push(word);
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `text` with each phrase blanked out, case-insensitive, longest first. */
function withoutPhrases(text: string, phrases: readonly string[]): string {
  const sorted = [...new Set(phrases.map((p) => p.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  return sorted.reduce((acc, p) => acc.replace(new RegExp(escapeRegExp(p), 'gi'), ' '), text);
}

export interface FigureCheckOptions {
  discreet: boolean;
  /** Brand, variant and alias strings from this turn's data: "Four Square" is a name, not a figure. */
  allowedPhrases?: readonly string[];
}

/** Digits and number words together: what the turn engine checks before showing a reply. */
export function findUnverifiedFigures(text: string, allowed: ReadonlySet<string>, opts: FigureCheckOptions): string[] {
  const words = withoutPhrases(text, opts.allowedPhrases ?? []);
  return [...findUnverifiedNumbers(text, allowed), ...findUnverifiedNumberWords(words, opts)];
}

/** Plain text only: no links, no markdown, no html, bounded length. */
export function sanitizeNarration(text: string): string {
  const cleaned = text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '')
    .replace(/[`*~]+/g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:#{1,6}\s+|[-+•]\s+|>\s*|\d+\.\s+)/, '').replace(/[ \t]{2,}/g, ' ').trim())
    .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0))
    .join('\n')
    .trim();
  return cleaned.slice(0, NARRATION_MAX_CHARS);
}
