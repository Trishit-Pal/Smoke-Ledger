import { redirect } from 'next/navigation';

export default function OnboardingSetupRedirect() {
  redirect('/onboarding/usage');
}
