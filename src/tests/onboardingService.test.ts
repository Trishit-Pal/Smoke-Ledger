import * as profileRepo from '@/db/repositories/profile';
import * as settingsRepo from '@/db/repositories/settings';
import * as goalsRepo from '@/db/repositories/goals';
import { recordAuditEvent } from '@/services/audit';
import { track } from '@/services/analytics';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { emptyGoalForm } from '@/domain/goalForm';
import { OnboardingUsageSchema, ProfilePatchSchema } from '@/lib/validation';
import type { Goal, UserProfile } from '@/types';
import {
  acceptChangedTerms,
  consentsCurrent,
  finishOnboarding,
  loadGoalStep,
  loadUsageStep,
  skipGoalStep,
  submitConsentStep,
  submitGoalStep,
  submitUsageStep,
} from '@/services/onboarding';

// ts-jest hoists jest.mock above the imports.
jest.mock('@/db/repositories/profile', () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  saveComplianceConsents: jest.fn(),
  setOnboardingStep: jest.fn(),
}));
jest.mock('@/db/repositories/settings', () => ({
  getSetting: jest.fn(),
  setSetting: jest.fn(),
}));
jest.mock('@/db/repositories/goals', () => ({
  listAllGoals: jest.fn(),
  createGoal: jest.fn(),
  updateGoal: jest.fn(),
  setGoalStatus: jest.fn(),
}));
jest.mock('@/services/audit', () => ({ recordAuditEvent: jest.fn() }));
jest.mock('@/services/analytics', () => ({
  track: jest.fn(),
  invalidateAnalyticsConsentCache: jest.fn(),
}));

const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as jest.MockedFunction<T>;

const baseProfile: UserProfile = {
  baselinePerDay: null,
  baselineWindowDays: 30,
  currency: 'INR',
  discreetMode: false,
  appLockEnabled: false,
  hideTotalsOnHome: false,
  onboardedAt: null,
  onboardingStep: null,
};

const consentedProfile: UserProfile = {
  ...baseProfile,
  ageConfirmedAt: '2026-01-01T00:00:00.000Z',
  dataProcessingConsentAt: '2026-01-01T00:00:00.000Z',
  termsVersion: LEGAL_VERSIONS.terms,
  privacyVersion: LEGAL_VERSIONS.privacy,
  healthDisclaimerVersion: LEGAL_VERSIONS.medicalDisclaimer,
  onboardingStep: 'brands',
};

const goal = (over: Partial<Goal>): Goal => ({
  id: 'gol_1',
  type: 'daily_cap',
  targetValue: 8,
  currentBaseline: null,
  startDate: '2026-11-01',
  endDate: null,
  status: 'active',
  meta: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  completedAt: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no other goals; tests that need strays override it.
  mocked(goalsRepo.listAllGoals).mockResolvedValue([]);
  mocked(goalsRepo.createGoal).mockImplementation(async (input) =>
    goal({ id: 'gol_new', type: input.type, targetValue: input.targetValue, meta: input.meta ?? null }),
  );
  mocked(goalsRepo.updateGoal).mockImplementation(async (id, patch) =>
    goal({ id, targetValue: patch.targetValue ?? 8 }),
  );
});

describe('consentsCurrent', () => {
  it('is true only when all five consents exist at the current legal versions', () => {
    expect(consentsCurrent(null)).toBe(false);
    expect(consentsCurrent(baseProfile)).toBe(false);
    expect(consentsCurrent(consentedProfile)).toBe(true);
    expect(consentsCurrent({ ...consentedProfile, termsVersion: '2020-01-01' })).toBe(false);
    expect(consentsCurrent({ ...consentedProfile, dataProcessingConsentAt: null })).toBe(false);
  });
});

describe('acceptChangedTerms (the /consent screen)', () => {
  it('stamps the current versions and the health consent, audits once, and never touches the step', async () => {
    await acceptChangedTerms({ needsHealthConsent: true, healthDataConsent: true });

    expect(profileRepo.saveComplianceConsents).toHaveBeenCalledTimes(1);
    const patch = mocked(profileRepo.saveComplianceConsents).mock.calls[0][0];
    expect(patch).toEqual({
      termsVersion: LEGAL_VERSIONS.terms,
      privacyVersion: LEGAL_VERSIONS.privacy,
      healthDisclaimerVersion: LEGAL_VERSIONS.medicalDisclaimer,
      healthDataConsentAt: expect.any(String),
    });
    expect('onboardingStep' in patch).toBe(false);
    expect(profileRepo.setOnboardingStep).not.toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      'consent_accepted',
      'compliance',
      expect.objectContaining({ termsVersion: LEGAL_VERSIONS.terms }),
    );
    // Audit lands first, so a failed audit never leaves a recorded consent without its row.
    expect(mocked(recordAuditEvent).mock.invocationCallOrder[0]).toBeLessThan(
      mocked(profileRepo.saveComplianceConsents).mock.invocationCallOrder[0],
    );
    // The analytics preference is not part of this screen.
    expect(settingsRepo.setSetting).not.toHaveBeenCalledWith('consent.analyticsOptIn', expect.anything());
  });

  it('does not restamp the health consent when it was already given', async () => {
    await acceptChangedTerms({ needsHealthConsent: false, healthDataConsent: false });
    const patch = mocked(profileRepo.saveComplianceConsents).mock.calls[0][0];
    expect('healthDataConsentAt' in patch).toBe(false);
  });

  it('refuses to continue without the health consent when it is missing, and writes nothing', async () => {
    await expect(
      acceptChangedTerms({ needsHealthConsent: true, healthDataConsent: false }),
    ).rejects.toThrow(/health-data consent/);
    expect(recordAuditEvent).not.toHaveBeenCalled();
    expect(profileRepo.saveComplianceConsents).not.toHaveBeenCalled();
  });
});

describe('acceptChangedTerms stamps a missing age or data-processing consent, and only that', () => {
  const base = { needsHealthConsent: false, healthDataConsent: false };

  it.each([
    ['age', { needsAgeConfirm: true, ageConfirmed: true }, ['ageConfirmedAt']],
    ['data processing', { needsDataProcessing: true, dataProcessingConsent: true }, ['dataProcessingConsentAt']],
    [
      'both',
      { needsAgeConfirm: true, ageConfirmed: true, needsDataProcessing: true, dataProcessingConsent: true },
      ['ageConfirmedAt', 'dataProcessingConsentAt'],
    ],
  ])('missing %s: stamps it alongside the versions', async (_n, input, stamped) => {
    await acceptChangedTerms({ ...base, ...input });
    const patch = mocked(profileRepo.saveComplianceConsents).mock.calls[0][0];
    expect(Object.keys(patch).sort()).toEqual(
      ['termsVersion', 'privacyVersion', 'healthDisclaimerVersion', ...stamped].sort(),
    );
    for (const key of stamped) expect(patch[key as keyof typeof patch]).toEqual(expect.any(String));
    expect('onboardingStep' in patch).toBe(false);
  });

  it('never restamps age or data processing when they were not missing, even if ticked', async () => {
    await acceptChangedTerms({ ...base, ageConfirmed: true, dataProcessingConsent: true });
    const patch = mocked(profileRepo.saveComplianceConsents).mock.calls[0][0];
    expect('ageConfirmedAt' in patch).toBe(false);
    expect('dataProcessingConsentAt' in patch).toBe(false);
  });

  it.each([
    ['age confirmation', { needsAgeConfirm: true, ageConfirmed: false }, /age confirmation/],
    ['data-processing consent', { needsDataProcessing: true, dataProcessingConsent: false }, /data-processing consent/],
  ])('refuses a missing %s that was not ticked, writing and auditing nothing', async (_n, input, message) => {
    await expect(acceptChangedTerms({ ...base, ...input })).rejects.toMatchObject({
      code: 'validation_error',
      message: expect.stringMatching(message),
    });
    expect(recordAuditEvent).not.toHaveBeenCalled();
    expect(profileRepo.saveComplianceConsents).not.toHaveBeenCalled();
    expect(settingsRepo.setSetting).not.toHaveBeenCalled();
  });
});

describe('acceptChangedTerms never downgrades a stored version', () => {
  it('keeps a newer stored version (an older build accepting) and writes the build version otherwise', async () => {
    mocked(profileRepo.getProfile).mockResolvedValueOnce({
      ...consentedProfile,
      termsVersion: '2099-01-01',
      privacyVersion: '2020-01-01',
      healthDisclaimerVersion: '1',
    });
    await acceptChangedTerms({ needsHealthConsent: false, healthDataConsent: false });
    const patch = mocked(profileRepo.saveComplianceConsents).mock.calls[0][0];
    expect(patch.termsVersion).toBe('2099-01-01');
    expect(patch.privacyVersion).toBe(LEGAL_VERSIONS.privacy);
    expect(patch.healthDisclaimerVersion).toBe(LEGAL_VERSIONS.medicalDisclaimer);
  });
});

describe('consentsCurrent across version skew', () => {
  it('counts a newer stored version as current, a legacy "1" as not', () => {
    expect(consentsCurrent({ ...consentedProfile, privacyVersion: '2099-01-01' })).toBe(true);
    expect(consentsCurrent({ ...consentedProfile, privacyVersion: '1' })).toBe(false);
  });
});

describe('submitConsentStep', () => {
  it('records consents + step in one profile write and audits once for a fresh user', async () => {
    await submitConsentStep({ alreadyConsented: false, analyticsOptIn: true, healthDataConsent: true });

    expect(profileRepo.saveComplianceConsents).toHaveBeenCalledTimes(1);
    const patch = mocked(profileRepo.saveComplianceConsents).mock.calls[0][0];
    expect(patch.onboardingStep).toBe('usage');
    expect(patch.termsVersion).toBe(LEGAL_VERSIONS.terms);
    expect(patch.ageConfirmedAt).toBeTruthy();
    expect(patch.dataProcessingConsentAt).toBeTruthy();
    // Analytics opt-in is not marketing consent.
    expect('marketingConsentAt' in patch).toBe(false);
    expect(profileRepo.setOnboardingStep).not.toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      'consent_accepted',
      'compliance',
      expect.objectContaining({ termsVersion: LEGAL_VERSIONS.terms }),
    );
    expect(settingsRepo.setSetting).toHaveBeenCalledWith('consent.analyticsOptIn', true);
    // Audit lands before the profile write, so a failed audit can never leave a
    // recorded consent without its audit row.
    const auditOrder = mocked(recordAuditEvent).mock.invocationCallOrder[0];
    const writeOrder = mocked(profileRepo.saveComplianceConsents).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(writeOrder);
  });

  it('stamps the explicit health-data consent with the other consents, and only then', async () => {
    await submitConsentStep({ alreadyConsented: false, analyticsOptIn: false, healthDataConsent: true });
    const patch = mocked(profileRepo.saveComplianceConsents).mock.calls[0][0];
    expect(patch.healthDataConsentAt).toBeTruthy();
    // Analytics off must not stop the health consent being recorded, and vice versa.
    expect(patch.dataProcessingConsentAt).toBeTruthy();
  });

  it('refuses to continue without the health-data consent, writing and auditing nothing', async () => {
    await expect(
      submitConsentStep({ alreadyConsented: false, analyticsOptIn: true, healthDataConsent: false }),
    ).rejects.toThrow(/health/i);
    expect(profileRepo.saveComplianceConsents).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
    expect(settingsRepo.setSetting).not.toHaveBeenCalled();
  });

  it('a failed audit aborts before any consent column is written', async () => {
    mocked(recordAuditEvent).mockRejectedValueOnce(new Error('audit down'));
    await expect(
      submitConsentStep({ alreadyConsented: false, analyticsOptIn: true, healthDataConsent: true }),
    ).rejects.toThrow('audit down');
    expect(profileRepo.saveComplianceConsents).not.toHaveBeenCalled();
    expect(settingsRepo.setSetting).not.toHaveBeenCalled();
  });

  it('a re-tick at the same versions writes no consent columns and no audit, only the preference', async () => {
    await submitConsentStep({ alreadyConsented: true, analyticsOptIn: false, healthDataConsent: true });

    expect(profileRepo.saveComplianceConsents).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
    expect(profileRepo.setOnboardingStep).toHaveBeenCalledWith('usage');
    expect(settingsRepo.setSetting).toHaveBeenCalledWith('consent.analyticsOptIn', false);
  });

  it('a legal-version bump makes the consent fresh again (consentsCurrent is version-aware)', () => {
    expect(consentsCurrent({ ...consentedProfile, privacyVersion: '2025-01-01' })).toBe(false);
  });
});

describe('loadUsageStep', () => {
  it('returns draft: null when the step was never saved', async () => {
    mocked(profileRepo.getProfile).mockResolvedValue(baseProfile);
    mocked(settingsRepo.getSetting).mockResolvedValue(null);
    await expect(loadUsageStep()).resolves.toEqual({ profile: baseProfile, draft: null });
  });

  it('prefers the typicalDaily setting, falls back to the profile baseline', async () => {
    mocked(profileRepo.getProfile).mockResolvedValue({
      ...baseProfile,
      baselinePerDay: 12,
      baselineWindowDays: 7,
    });
    mocked(settingsRepo.getSetting).mockImplementation(async (key: string) =>
      key === 'onboarding.purchasePref' ? 'pack' : null,
    );
    const { draft } = await loadUsageStep();
    expect(draft).toEqual({ perDay: 12, windowDays: 7, purchasePref: 'pack' });

    mocked(settingsRepo.getSetting).mockImplementation(async (key: string) =>
      key === 'onboarding.typicalDaily' ? 15 : null,
    );
    const second = await loadUsageStep();
    expect(second.draft).toEqual({ perDay: 15, windowDays: 7, purchasePref: null });
  });
});

describe('submitUsageStep', () => {
  it('writes baseline + step in the same profile update and mirrors the settings', async () => {
    await submitUsageStep({ perDay: 12, windowDays: 7, purchasePref: 'single' });
    expect(profileRepo.updateProfile).toHaveBeenCalledWith({
      baselinePerDay: 12,
      baselineWindowDays: 7,
      onboardingStep: 'goal',
    });
    expect(settingsRepo.setSetting).toHaveBeenCalledWith('onboarding.typicalDaily', 12);
    expect(settingsRepo.setSetting).toHaveBeenCalledWith('onboarding.purchasePref', 'single');
  });

  it('rejects out-of-range input before any write', async () => {
    await expect(
      submitUsageStep({ perDay: -1, windowDays: 30, purchasePref: 'single' }),
    ).rejects.toThrow(/Validation failed for onboarding_usage/);
    await expect(
      // @ts-expect-error — the schema is the boundary; 14 is not an offered window
      submitUsageStep({ perDay: 5, windowDays: 14, purchasePref: 'single' }),
    ).rejects.toThrow(/Validation failed for onboarding_usage/);
    expect(profileRepo.updateProfile).not.toHaveBeenCalled();
    expect(settingsRepo.setSetting).not.toHaveBeenCalled();
  });
});

describe('loadGoalStep', () => {
  it('returns an empty draft when no onboarding goal exists', async () => {
    mocked(goalsRepo.listAllGoals).mockResolvedValue([]);
    await expect(loadGoalStep()).resolves.toEqual({ existing: null, goalType: null, goalTarget: '' });
  });

  it('seeds the draft from the newest active goal of an offered type', async () => {
    mocked(goalsRepo.listAllGoals).mockResolvedValue([
      goal({ id: 'gol_abandoned', status: 'abandoned', type: 'spend_cap_daily', targetValue: 100 }),
      goal({ id: 'gol_active', type: 'daily_cap', targetValue: 8 }),
      goal({ id: 'gol_other', type: 'weekly_target', targetValue: 40 }),
    ]);
    const draft = await loadGoalStep();
    expect(draft.existing?.id).toBe('gol_active');
    expect(draft.goalType).toBe('daily_cap');
    expect(draft.goalTarget).toBe('8');
  });

  it('a window goal has no numeric target to prefill', async () => {
    mocked(goalsRepo.listAllGoals).mockResolvedValue([
      goal({ type: 'no_smoke_window', targetValue: 1, meta: { startHour: 22, endHour: 6 } }),
    ]);
    const draft = await loadGoalStep();
    expect(draft.goalType).toBe('no_smoke_window');
    expect(draft.goalTarget).toBe('');
  });
});

describe('submitGoalStep', () => {
  it('creates when nothing exists, tracks, then advances to brands', async () => {
    await submitGoalStep({ ...emptyGoalForm('daily_cap'), target: '8' }, null);
    expect(goalsRepo.createGoal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'daily_cap', targetValue: 8 }),
    );
    expect(track).toHaveBeenCalledTimes(1);
    expect(profileRepo.setOnboardingStep).toHaveBeenCalledWith('brands');
  });

  it('same type → updates the existing goal in place (no second active goal)', async () => {
    const existing = goal({ id: 'gol_1', type: 'daily_cap', targetValue: 8 });
    await submitGoalStep({ ...emptyGoalForm('daily_cap'), target: '6' }, existing);
    expect(goalsRepo.updateGoal).toHaveBeenCalledWith('gol_1', { targetValue: 6, meta: null });
    expect(goalsRepo.createGoal).not.toHaveBeenCalled();
    expect(goalsRepo.setGoalStatus).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(profileRepo.setOnboardingStep).toHaveBeenCalledWith('brands');
  });

  it('different type → creates the new goal, then abandons the old one', async () => {
    const existing = goal({ id: 'gol_1', type: 'daily_cap', targetValue: 8 });
    mocked(goalsRepo.listAllGoals).mockResolvedValue([
      goal({ id: 'gol_new', type: 'spend_cap_daily', targetValue: 100 }),
      existing,
    ]);
    await submitGoalStep({ ...emptyGoalForm('spend_cap_daily'), target: '100' }, existing);
    expect(goalsRepo.setGoalStatus).toHaveBeenCalledWith('gol_1', 'abandoned');
    expect(goalsRepo.createGoal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'spend_cap_daily', targetValue: 100 }),
    );
    const abandonOrder = mocked(goalsRepo.setGoalStatus).mock.invocationCallOrder[0];
    const createOrder = mocked(goalsRepo.createGoal).mock.invocationCallOrder[0];
    expect(createOrder).toBeLessThan(abandonOrder);
  });

  it('a failed create leaves the existing goal active (nothing abandoned, no step advance)', async () => {
    const existing = goal({ id: 'gol_1', type: 'daily_cap', targetValue: 8 });
    mocked(goalsRepo.createGoal).mockRejectedValueOnce(new Error('offline'));
    await expect(
      submitGoalStep({ ...emptyGoalForm('spend_cap_daily'), target: '100' }, existing),
    ).rejects.toThrow('offline');
    expect(goalsRepo.setGoalStatus).not.toHaveBeenCalled();
    expect(profileRepo.setOnboardingStep).not.toHaveBeenCalled();
  });

  it('an invalid form throws validation_error and writes nothing', async () => {
    await expect(
      submitGoalStep({ ...emptyGoalForm('daily_cap'), target: '0' }, null),
    ).rejects.toMatchObject({ code: 'validation_error', message: 'Enter a target greater than 0.' });
    expect(goalsRepo.createGoal).not.toHaveBeenCalled();
    expect(profileRepo.setOnboardingStep).not.toHaveBeenCalled();
  });

  it('skipGoalStep only advances the step and surfaces failures', async () => {
    await skipGoalStep();
    expect(profileRepo.setOnboardingStep).toHaveBeenCalledWith('brands');
    mocked(profileRepo.setOnboardingStep).mockRejectedValueOnce(new Error('offline'));
    await expect(skipGoalStep()).rejects.toThrow('offline');
  });
});

describe('finishOnboarding', () => {
  it('marks onboarded + step done in one update; audit failure is non-fatal', async () => {
    mocked(recordAuditEvent).mockRejectedValueOnce(new Error('audit down'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(finishOnboarding()).resolves.toBeUndefined();
    expect(profileRepo.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ onboardingStep: 'done', onboardedAt: expect.any(String) }),
    );
    expect(settingsRepo.setSetting).toHaveBeenCalledWith(
      'consent.onboardingCompletedAt',
      expect.any(String),
    );
    warn.mockRestore();
  });
});

describe('schemas', () => {
  it('ProfilePatchSchema accepts a valid onboardingStep and rejects an unknown one', () => {
    expect(ProfilePatchSchema.safeParse({ onboardingStep: 'goal' }).success).toBe(true);
    expect(ProfilePatchSchema.safeParse({ onboardingStep: 'welcome' }).success).toBe(false);
  });

  it('OnboardingUsageSchema is strict about the offered windows and purchase prefs', () => {
    expect(
      OnboardingUsageSchema.safeParse({ perDay: 10, windowDays: 30, purchasePref: 'mixed' }).success,
    ).toBe(true);
    expect(
      OnboardingUsageSchema.safeParse({ perDay: 10, windowDays: 30, purchasePref: 'carton' }).success,
    ).toBe(false);
    expect(OnboardingUsageSchema.safeParse({ perDay: 201, windowDays: 30, purchasePref: 'mixed' }).success).toBe(
      false,
    );
  });
});

describe('submitGoalStep — retries after a half-failure heal to one active goal', () => {
  it('abandons EVERY other active onboarding-type goal, not only `existing`', async () => {
    // A previous attempt created spend_cap but failed before abandoning daily_cap.
    mocked(goalsRepo.listAllGoals).mockResolvedValue([
      goal({ id: 'gol_new', type: 'no_smoke_window', targetValue: 1 }),
      goal({ id: 'gol_spend', type: 'spend_cap_daily', targetValue: 100 }),
      goal({ id: 'gol_daily', type: 'daily_cap', targetValue: 8 }),
      goal({ id: 'gol_week', type: 'weekly_target', targetValue: 40 }), // not offered in onboarding
      goal({ id: 'gol_old', type: 'daily_cap', status: 'abandoned' }),
    ]);
    await submitGoalStep(emptyGoalForm('no_smoke_window'), null);
    const abandoned = mocked(goalsRepo.setGoalStatus).mock.calls.map(([id]) => id);
    expect(abandoned.sort()).toEqual(['gol_daily', 'gol_spend']);
    expect(profileRepo.setOnboardingStep).toHaveBeenCalledWith('brands');
  });

  it('same-type retry after a failed step write updates the created goal, never creates again', async () => {
    mocked(profileRepo.setOnboardingStep).mockRejectedValueOnce(new Error('offline'));
    await expect(
      submitGoalStep({ ...emptyGoalForm('daily_cap'), target: '8' }, null),
    ).rejects.toThrow('offline');
    expect(goalsRepo.createGoal).toHaveBeenCalledTimes(1);

    // The client re-reads loadGoalStep() and retries with the created goal.
    const created = goal({ id: 'gol_new', type: 'daily_cap', targetValue: 8 });
    mocked(goalsRepo.listAllGoals).mockResolvedValue([created]);
    await submitGoalStep({ ...emptyGoalForm('daily_cap'), target: '8' }, created);
    expect(goalsRepo.createGoal).toHaveBeenCalledTimes(1);
    expect(goalsRepo.updateGoal).toHaveBeenCalledWith('gol_new', { targetValue: 8, meta: null });
    expect(goalsRepo.setGoalStatus).not.toHaveBeenCalled();
  });

  it('analytics never gates the step: a hanging track() still lets the call resolve', async () => {
    mocked(track).mockReturnValueOnce(new Promise<void>(() => {}));
    await expect(
      submitGoalStep({ ...emptyGoalForm('daily_cap'), target: '8' }, null),
    ).resolves.toMatchObject({ type: 'daily_cap' });
  });
});

describe('the consent repository cannot write marketing consent', () => {
  it('ComplianceConsentPatch has no marketingConsentAt field', () => {
    const patch: Parameters<typeof profileRepo.saveComplianceConsents>[0] = {
      // @ts-expect-error — removed: no client may write marketing_consent_at (CHECK in 20261102120000)
      marketingConsentAt: null,
    };
    expect(patch).toBeDefined();
  });
});
