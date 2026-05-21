import { redirect } from 'next/navigation';

export default function OnboardingBaselineRedirect() {
  redirect('/onboarding/usage');
}
