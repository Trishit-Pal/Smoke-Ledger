import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

// Reads the real tokens out of globals.css so a palette edit that breaks AA fails CI.
const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('\n}', start));
  const tokens: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) tokens[m[1]] = m[2];
  return tokens;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;

const themes = { light: block(':root'), dark: block('.dark') } as const;

// [foreground token, background token] pairs that carry meaningful text.
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['--text', '--bg'],
  ['--text', '--card'],
  ['--text-muted', '--bg'],
  ['--text-muted', '--card'],
  ['--text-faint', '--bg'],
  ['--text-faint', '--card'],
  ['--accent-ink', '--bg'],
  ['--accent-ink', '--card'],
  ['--accent-ink', '--accent-soft'],
  ['--on-accent', '--accent-ink'],
  ['--on-accent', '--warn-earth-ink'],
  ['--warn-earth-ink', '--bg'],
  ['--warn-earth-ink', '--card'],
  ['--warn-earth-ink', '--warn-earth-soft'],
];

describe.each(Object.entries(themes))('%s theme token contrast', (_name, tokens) => {
  it.each(PAIRS)('%s on %s meets AA (4.5:1)', (fg, bg) => {
    expect(tokens[fg], `${fg} is defined`).toBeDefined();
    expect(tokens[bg], `${bg} is defined`).toBeDefined();
    expect(ratio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
