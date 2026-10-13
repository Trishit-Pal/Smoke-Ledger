import { getServerProfile } from '@web/lib/server/data';
import { isNextRedirectError } from '@web/lib/auth/authCatch';
import { OnboardingGoalClient } from './OnboardingGoalClient';

export const dynamic = 'force-dynamic';

export default async function OnboardingGoalPage() {
  const profile = await getServerProfile().catch((e) => {
    if (isNextRedirectError(e)) throw e;
    console.error('[onboarding/goal] getServerProfile failed', e);
    return null;
  });

  return <OnboardingGoalClient country={profile?.country ?? null} />;
}
