// Output guards. The model is asked never to write numbers; this is the check
// that makes the promise hold. A figure in the narration must exist in a tool
// result, or be a time or a short duration, or it is unverified.

import type { ToolOutcome } from './tools';

export const NARRATION_MAX_CHARS = 800;

/** A clock time, or a number with optional grouping (1,200 · 1,00,000 · 1 200) and decimals. */
const NUMBER_TOKEN = /\d{1,2}:\d{2}|\d+(?:[,   ]\d{2,3})*(?:\.\d+)?/g;
/** What may follow a small integer for it to read as a time or a duration, not a figure. */
const DURATION_CONTEXT =
  /^\s*(?::\d{2}|(?:am|pm|a\.m\.|p\.m\.|o'clock|days?|weeks?|months?|years?|hours?|hrs?|minutes?|mins?)\b)/i;
const SMALL_INT_MAX = 31;
const COMMON_WINDOWS = new Set(['7', '30', '90', '365']);

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
    for (const m of value.match(NUMBER_TOKEN) ?? []) {
      if (m.includes(':')) continue;
      const n = Number(normalizeToken(m));
      if (Number.isFinite(n)) addNumber(set, n);
    }
  } else if (Array.isArray(value)) {
    value.forEach((v) => harvest(set, v));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => harvest(set, v));
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

/** Digit-runs in `text` that are neither tool figures nor times or durations. */
export function findUnverifiedNumbers(text: string, allowed: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const re = new RegExp(NUMBER_TOKEN.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (raw.includes(':')) continue;
    const norm = normalizeToken(raw);
    if (allowed.has(norm)) continue;
    const rounded = String(Math.round(Number(norm)));
    if (norm.includes('.') && allowed.has(rounded)) continue;
    if (isDurationLike(norm, text.slice(m.index + raw.length))) continue;
    out.push(raw);
  }
  return out;
}

// Number words (gap N2): a figure spelled out dodges the digit check above.
// "one" and "two" are left alone; they are everyday English ("one of", "two
// quiet days"). Hinglish words count only before a unit, because "do" is also
// English ("do you").
const TENS = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';
const ONES = 'one|two|three|four|five|six|seven|eight|nine';
const ENGLISH_WORDS =
  `(?:${TENS})(?:-(?:${ONES}))?|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen` +
  '|sixteen|seventeen|eighteen|nineteen|hundreds?|thousands?|lakhs?|crores?|millions?|percent|per\\s+cent';
const HINGLISH_WORDS = 'ek|do|teen|char|chaar|paanch|panch|chhe|saat|aath|nau|das';
const HINGLISH_UNIT = '(?=\\s+(?:sticks?|cigarettes?|cigs?|packs?|rupees?|rs|euros?|baar|din|ghante)\\b)';
const NUMBER_WORD = new RegExp(`\\b(?:${ENGLISH_WORDS})\\b|\\b(?:${HINGLISH_WORDS})\\b${HINGLISH_UNIT}`, 'gi');
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
  const re = new RegExp(NUMBER_WORD.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const word = m[0];
    const before = text.slice(0, m.index);
    if (/^per/i.test(word) && /\d\s*$/.test(before)) continue;
    if (!opts.discreet && WORD_DURATION_CONTEXT.test(text.slice(m.index + word.length))) continue;
    out.push(word);
  }
  return out;
}

/** Digits and number words together: what the turn engine checks before showing a reply. */
export function findUnverifiedFigures(
  text: string,
  allowed: ReadonlySet<string>,
  opts: { discreet: boolean },
): string[] {
  return [...findUnverifiedNumbers(text, allowed), ...findUnverifiedNumberWords(text, opts)];
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
