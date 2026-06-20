import { useOnboardingDraft } from '@/store/onboardingDraft';

const reset = () => useOnboardingDraft.getState().clear();

describe('onboardingDraft store', () => {
  beforeEach(reset);

  it('starts empty so steps fall back to their own defaults', () => {
    const s = useOnboardingDraft.getState();
    expect(s.perDay).toBeNull();
    expect(s.windowDays).toBeNull();
    expect(s.purchasePref).toBeNull();
    expect(s.goalType).toBeNull();
    expect(s.goalTarget).toBe('');
    expect(s.consents).toEqual({});
  });

  it('retains usage values across partial updates (the back-nav fix)', () => {
    useOnboardingDraft.getState().setUsage({ perDay: 7 });
    useOnboardingDraft.getState().setUsage({ purchasePref: 'pack' });
    const s = useOnboardingDraft.getState();
    expect(s.perDay).toBe(7); // not lost by the second partial update
    expect(s.purchasePref).toBe('pack');
  });

  it('records individual consent toggles without dropping the others', () => {
    useOnboardingDraft.getState().setConsent('age', true);
    useOnboardingDraft.getState().setConsent('terms', true);
    useOnboardingDraft.getState().setConsent('age', false);
    expect(useOnboardingDraft.getState().consents).toEqual({ age: false, terms: true });
  });

  it('retains goal type and target', () => {
    useOnboardingDraft.getState().setGoal({ goalType: 'daily_cap' });
    useOnboardingDraft.getState().setGoal({ goalTarget: '8' });
    const s = useOnboardingDraft.getState();
    expect(s.goalType).toBe('daily_cap');
    expect(s.goalTarget).toBe('8');
  });

  it('clear() wipes everything (logout / onboarding complete)', () => {
    useOnboardingDraft.getState().setUsage({ perDay: 12, windowDays: 7 });
    useOnboardingDraft.getState().setConsent('age', true);
    useOnboardingDraft.getState().setGoal({ goalType: 'spend_cap_daily', goalTarget: '100' });
    useOnboardingDraft.getState().clear();
    const s = useOnboardingDraft.getState();
    expect(s.perDay).toBeNull();
    expect(s.windowDays).toBeNull();
    expect(s.consents).toEqual({});
    expect(s.goalType).toBeNull();
    expect(s.goalTarget).toBe('');
  });
});
