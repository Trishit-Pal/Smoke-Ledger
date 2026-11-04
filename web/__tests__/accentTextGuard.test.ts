import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import * as authStyles from '@web/lib/auth/inputStyle';

// `--accent` (#2FA39B) is ~2.9:1 on the light background: fine for borders, fills, rings and
// chart strokes, never for text. Text uses `--accent-ink` (AA in both themes).
//
// Scope (line-based, deliberately simple): it flags
//   - a line where a `color`-named key/variable (`color:`, `trendColour =`, ...) is followed by the
//     exact string 'var(--accent)' (covers ternaries on one line),
//   - `color: var(--accent);` in CSS (not `border-color` / `background-color`),
//   - Tailwind `text-accent` not followed by `-` (so `text-accent-ink` is fine).
// It cannot follow a tone helper whose result is applied elsewhere (e.g. a function that returns
// 'var(--accent)' on its own line); those are fixed by hand.
const WEB = path.resolve(__dirname, '..');
const ROOTS = ['app', 'components'];

const PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['color style/variable set to var(--accent)', /colou?r\w*\s*[:=][^\n]*['"]var\(--accent\)['"]/i],
  ['CSS color: var(--accent)', /(?:^|[^-\w])color:\s*var\(--accent\)\s*;/],
  ['Tailwind text-accent', /text-accent(?![\w-])/],
];

// file:line -> reason. Only proven non-text uses that the patterns above cannot tell apart.
const ALLOWLIST: Readonly<Record<string, string>> = {
  'components/ui/ProgressRing.tsx:31': 'ring stroke default, not text',
  'components/dashboard/WeekStrip.tsx:37': 'bar fill (background), not text',
  'app/(app)/dashboard/DashboardClient.tsx:553': 'progressColor is the ring stroke, not text',
};

function sourceFiles(): string[] {
  const files = ROOTS.flatMap((root) =>
    (readdirSync(path.join(WEB, root), { recursive: true }) as string[])
      .filter((f) => /\.(tsx?|css)$/.test(f))
      .map((f) => `${root}/${f.replace(/\\/g, '/')}`),
  );
  return [...files, 'app/globals.css'].filter((f, i, all) => all.indexOf(f) === i);
}

function violations(): string[] {
  const found: string[] = [];
  for (const file of sourceFiles()) {
    readFileSync(path.join(WEB, file), 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        const key = `${file}:${i + 1}`;
        for (const [name, re] of PATTERNS) {
          if (re.test(line) && !ALLOWLIST[key]) found.push(`${key} ${name}: ${line.trim()}`);
        }
      });
  }
  return found;
}

describe('teal text uses --accent-ink, never --accent', () => {
  it('finds no text coloured with --accent', () => {
    expect(violations()).toEqual([]);
  });

  // White on --accent is ~3.1:1. A filled teal control carries text, so it is the
  // --accent-ink / --on-accent pair (pinned AA in tokenContrast.test.ts).
  it('shared auth button styles put --on-accent text on an --accent-ink fill', () => {
    const teal = Object.entries(authStyles).filter(([, s]) => String(s.background).includes('--accent'));
    expect(teal.map(([name]) => name)).toContain('PRIMARY_CTA_STYLE');
    for (const [name, s] of teal) {
      expect([name, s.background, s.color]).toEqual([name, 'var(--accent-ink)', 'var(--on-accent)']);
    }
    const source = readFileSync(path.join(WEB, 'lib/auth/inputStyle.ts'), 'utf8');
    expect(source, 'hard-coded white text colour in inputStyle.ts').not.toMatch(
      /(?:^|[^-\w])color:\s*['"]#f{3}(?:f{3})?['"]/im,
    );
  });

  it('keeps the allowlist honest (every entry still points at a matching line)', () => {
    for (const key of Object.keys(ALLOWLIST)) {
      const [file, line] = [key.slice(0, key.lastIndexOf(':')), Number(key.slice(key.lastIndexOf(':') + 1))];
      const text = readFileSync(path.join(WEB, file), 'utf8').split(/\r?\n/)[line - 1] ?? '';
      expect(PATTERNS.some(([, re]) => re.test(text)), `${key} no longer trips a pattern`).toBe(true);
    }
  });
});
