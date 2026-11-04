import { termsChanged } from '@/lib/onboardingSteps';
import { getServerProfile } from '@web/lib/server/data';
import { shouldAskChat } from '@web/lib/server/ledgerChat/askChat';
import { ConsentClient } from './ConsentClient';

export const dynamic = 'force-dynamic';

// Reached only by the middleware's re-consent gate (an onboarded reader missing a
// consent, or holding versions older than the current ones, or no health-data
// consent yet). A current user who types the URL is sent home by the same gate.
export default async function ConsentPage() {
  // The Ask the ledger Yes / No is shown only to a reader who has never answered.
  // Independent reads, so run them together (shouldAskChat never throws).
  const [profile, chatAsk] = await Promise.all([getServerProfile(), shouldAskChat()]);
  return (
    <ConsentClient
      termsChanged={termsChanged(profile)}
      needsHealthConsent={!profile.healthDataConsentAt}
      needsAgeConfirm={!profile.ageConfirmedAt}
      needsDataProcessing={!profile.dataProcessingConsentAt}
      chatAsk={chatAsk}
    />
  );
}
