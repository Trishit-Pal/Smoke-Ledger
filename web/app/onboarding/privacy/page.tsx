import { getServerProfile } from '@web/lib/server/data';
import { isNextRedirectError } from '@web/lib/auth/authCatch';
import { consentsCurrent } from '@/services/onboarding';
import { OnboardingPrivacyClient } from './OnboardingPrivacyClient';

export const dynamic = 'force-dynamic';

export default async function OnboardingPrivacyPage() {
  // Only a boolean crosses to the client: whether the saved consents are
  // already at the current legal versions. A re-tick then skips the consent
  // rewrite + duplicate audit (see submitConsentStep). Boxes themselves are
  // never pre-filled: consent is a fresh decision.
  const profile = await getServerProfile().catch((e) => {
    if (isNextRedirectError(e)) throw e;
    console.error('[onboarding/privacy] getServerProfile failed', e);
    return null;
  });

  return <OnboardingPrivacyClient alreadyConsented={consentsCurrent(profile)} />;
}
