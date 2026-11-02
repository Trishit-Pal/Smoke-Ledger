import { describe, expect, it } from 'vitest';
import { emptyGoalForm, proposalToForm, type GoalFormState } from '@/domain/goalForm';
import type { Proposal } from '@/domain/goalProposals';
import { isFromProposal, offersStartProposal, proposalButtonLabel, parseTypeParam, periodUnitLabel } from '../app/(app)/goals/goalsView';

const proposal: Proposal = { kind: 'start', type: 'daily_cap', value: 6, unit: 'sticks', basisAvg: 7.2 };
const seeded = (): GoalFormState => ({ ...emptyGoalForm('daily_cap'), ...proposalToForm(proposal) });

describe('parseTypeParam', () => {
  it('accepts a creatable goal type', () => {
    expect(parseTypeParam('taper')).toBe('taper');
    expect(parseTypeParam('spend_cap_daily')).toBe('spend_cap_daily');
  });
  it('rejects null, junk and legacy-only types', () => {
    expect(parseTypeParam(null)).toBeNull();
    expect(parseTypeParam('')).toBeNull();
    expect(parseTypeParam('nope')).toBeNull();
    expect(parseTypeParam('reduction_target')).toBeNull();
  });
});

describe('isFromProposal', () => {
  it('is false when the form was never seeded', () => {
    expect(isFromProposal(emptyGoalForm(), null)).toBe(false);
  });
  it('is true while target, period and quit date match the seed', () => {
    expect(isFromProposal(seeded(), seeded())).toBe(true);
  });
  it('is false once the target is edited', () => {
    expect(isFromProposal({ ...seeded(), target: '5' }, seeded())).toBe(false);
  });
  it('is false once the period or quit date changes', () => {
    expect(isFromProposal({ ...seeded(), period: 'week' }, seeded())).toBe(false);
    expect(isFromProposal({ ...seeded(), quitDate: '2026-12-01' }, seeded())).toBe(false);
  });
  it('ignores fields the proposal does not own', () => {
    expect(isFromProposal({ ...seeded(), baseline: '9' }, seeded())).toBe(true);
  });
});

describe('periodUnitLabel', () => {
  it('follows currency and period', () => {
    expect(periodUnitLabel('INR', 'day')).toBe('₹/day');
    expect(periodUnitLabel('EUR', 'week')).toBe('€/week');
    expect(periodUnitLabel('INR', 'month')).toBe('₹/month');
  });
});

describe('offersStartProposal', () => {
  it('is false only for the no-smoke window', () => {
    expect(offersStartProposal('no_smoke_window')).toBe(false);
    expect(offersStartProposal('daily_cap')).toBe(true);
    expect(offersStartProposal('quit_date')).toBe(true);
  });
});

describe('proposalButtonLabel', () => {
  it('names the value when it is visible', () => {
    expect(proposalButtonLabel('6 / day', false)).toBe('Use 6 / day');
  });
  it('never echoes a masked value', () => {
    expect(proposalButtonLabel('—', true)).toBe('Use the suggestion');
  });
});
