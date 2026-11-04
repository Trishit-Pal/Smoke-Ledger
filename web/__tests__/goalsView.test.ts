import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { stateColor, stateTextColor } from '../lib/goals/goalCardModel';

const read = (...p: string[]) => readFileSync(path.resolve(__dirname, '..', ...p), 'utf8');

describe('stateColor', () => {
  it('is teal only for on-track and met (ring strokes)', () => {
    expect(stateColor('on_track')).toBe('var(--accent)');
    expect(stateColor('met')).toBe('var(--accent)');
    expect(stateColor('at_risk')).toBe('var(--warn-earth)');
    expect(stateColor('off_track')).toBe('var(--warn-earth)');
  });
});

describe('stateTextColor', () => {
  it('uses the AA ink tokens, since the state caption and the % numeral are text', () => {
    expect(stateTextColor('on_track')).toBe('var(--accent-ink)');
    expect(stateTextColor('met')).toBe('var(--accent-ink)');
    expect(stateTextColor('at_risk')).toBe('var(--warn-earth-ink)');
    expect(stateTextColor('off_track')).toBe('var(--warn-earth-ink)');
  });

  it('colours every goal-state text site; the rings keep the stroke colour', () => {
    expect(read('app', '(app)', 'goals', 'GoalStateCaption.tsx')).toContain('color: stateTextColor(state)');
    const card = read('app', '(app)', 'goals', 'GoalCard.tsx');
    expect(card).toMatch(/editorial-numeral--micro[^\n]*style=\{\{ color: toneTextColor \}\}/);
    expect(card).toContain('<ProgressRing percent={pct} color={toneColor}');
    const dash = read('app', '(app)', 'dashboard', 'DashboardClient.tsx');
    expect(dash).toMatch(/editorial-numeral--micro"[^\n]*style=\{\{ color: goalToneTextColor \}\}/);
  });
});
