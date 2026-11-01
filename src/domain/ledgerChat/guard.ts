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
  const abs = Math.abs(n);
  for (const s of [String(abs), String(Math.round(abs)), abs.toFixed(1), abs.toFixed(2), String(Math.floor(abs)), String(Math.ceil(abs))]) {
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
export function allowedNumbers(outcomes: readonly ToolOutcome[], opts: { year: string }): Set<string> {
  const set = new Set<string>([opts.year]);
  for (const o of outcomes) {
    if (!o.ok) continue;
    harvest(set, o.data);
    harvest(set, o.rows);
  }
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
