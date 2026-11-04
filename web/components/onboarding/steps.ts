/**
 * The onboarding steps, in order. One source for the rail, the phone progress
 * line, the Welcome step list and sign-up's progress line, so their step names
 * can never disagree.
 */
export type OnboardingStepKey = 'welcome' | 'privacy' | 'usage' | 'goal' | 'brands' | 'done';

/** The steps that ask the reader something (Welcome and Done ask nothing). */
export type SetupStepKey = Exclude<OnboardingStepKey, 'welcome' | 'done'>;

export interface OnboardingStep<K extends OnboardingStepKey = OnboardingStepKey> {
  key: K;
  index: string;
  label: string;
  href: string | null;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { key: 'welcome', index: '00', label: 'Welcome', href: '/onboarding' },
  { key: 'privacy', index: '01', label: 'Privacy', href: '/onboarding/privacy' },
  { key: 'usage', index: '02', label: 'Baseline', href: '/onboarding/usage' },
  { key: 'goal', index: '03', label: 'Goal', href: '/onboarding/goal' },
  { key: 'brands', index: '04', label: 'Brands', href: '/onboarding/brands' },
  { key: 'done', index: '05', label: 'Done', href: null },
];

export const SETUP_STEPS = ONBOARDING_STEPS.filter(
  (s): s is OnboardingStep<SetupStepKey> => s.key !== 'welcome' && s.key !== 'done',
);
