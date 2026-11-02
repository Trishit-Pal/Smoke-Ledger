import { describe, expect, it } from 'vitest';
import { stateColor } from '../lib/goals/goalCardModel';

describe('stateColor', () => {
  it('is teal only for on-track and met', () => {
    expect(stateColor('on_track')).toBe('var(--accent)');
    expect(stateColor('met')).toBe('var(--accent)');
    expect(stateColor('at_risk')).toBe('var(--warn-earth)');
    expect(stateColor('off_track')).toBe('var(--warn-earth)');
  });
});
