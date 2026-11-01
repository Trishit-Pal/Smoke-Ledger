import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, test } from 'vitest';

// PR #102's one CI failure: the discreet check called raw `fresh.goto`, so the
// interrupted-navigation retry in gotoSettled never fired. Every goto in the spec
// must route through gotoSettled; this fails the moment a raw one is reintroduced.
const src = readFileSync(path.resolve(__dirname, '..', 'e2e/responsive.spec.ts'), 'utf8');

describe('responsive spec navigation', () => {
  test('every page navigation goes through gotoSettled', () => {
    // Strip gotoSettled's own body, which is the one place a raw goto belongs.
    const start = src.indexOf('async function gotoSettled');
    const end = src.indexOf('\n}', start) + 2;
    const outside = src.slice(0, start) + src.slice(end);
    const raw = outside.match(/\.goto\(/g) ?? [];
    expect(raw, `raw .goto( calls outside gotoSettled: ${raw.length}`).toHaveLength(0);
  });
});
