import { describe, expect, it } from 'vitest';
import { canContinueGoalStep } from '../app/onboarding/goal/goalStepView';

const cap = { window: false };
const win = { window: true };

describe('canContinueGoalStep', () => {
  it('is false until the existing-goal lookup has loaded', () => {
    expect(canContinueGoalStep({ loaded: false, type: null, selected: null, target: '' })).toBe(false);
    expect(canContinueGoalStep({ loaded: false, type: 'daily_cap', selected: cap, target: '8' })).toBe(false);
  });
  it('is true for "Suggest one later" (null type) once loaded', () => {
    expect(canContinueGoalStep({ loaded: true, type: null, selected: null, target: '' })).toBe(true);
  });
  it('is true for a window goal with no target', () => {
    expect(canContinueGoalStep({ loaded: true, type: 'no_smoke_window', selected: win, target: '' })).toBe(true);
  });
  it('needs a positive target for a numeric goal', () => {
    expect(canContinueGoalStep({ loaded: true, type: 'daily_cap', selected: cap, target: '8' })).toBe(true);
    expect(canContinueGoalStep({ loaded: true, type: 'daily_cap', selected: cap, target: '0' })).toBe(false);
    expect(canContinueGoalStep({ loaded: true, type: 'daily_cap', selected: cap, target: '-2' })).toBe(false);
    expect(canContinueGoalStep({ loaded: true, type: 'daily_cap', selected: cap, target: '' })).toBe(false);
  });
  it('is false for a type that has no card', () => {
    expect(canContinueGoalStep({ loaded: true, type: 'taper', selected: null, target: '5' })).toBe(false);
  });
});
