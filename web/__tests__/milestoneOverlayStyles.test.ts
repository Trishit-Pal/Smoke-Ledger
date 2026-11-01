import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, test } from 'vitest';

// Tailwind's theme() only resolves inside CSS that Tailwind processes. In a React
// inline `style={{}}` string the browser sees the literal text, rejects the
// declaration, and the card renders with no padding. Tokens for inline React
// styles are Tailwind classes, not theme() calls.
const src = readFileSync(path.resolve(__dirname, '..', 'components/character/MilestoneCelebration.tsx'), 'utf8');

describe('MilestoneCelebration card padding', () => {
  test('never puts a Tailwind theme() call inside an inline style', () => {
    const inlineStyleBlocks = src.match(/style=\{\{[^}]*\}\}/g) ?? [];
    expect(inlineStyleBlocks.length).toBeGreaterThan(0);
    for (const block of inlineStyleBlocks) expect(block).not.toContain('theme(');
  });
  test('uses the spacing token classes for the card padding', () => {
    expect(src).toMatch(/className="character-modal[^"]*\bpy-xxl\b[^"]*\bpx-\[clamp\(/);
  });
});
