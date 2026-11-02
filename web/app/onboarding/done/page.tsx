import * as React from 'react';
import {
  getServerProfile,
  getServerGoals,
  getServerBrandsWithVariants,
  getServerSetting,
} from '@web/lib/server/data';
import { OnboardingDoneClient } from './OnboardingDoneClient';

export const dynamic = 'force-dynamic';

export default async function OnboardingDonePage() {
  // Read through the server data layer (real cookie-bound client). The earlier
  // version used the shared @/db/repositories/* helpers, which the webpack alias
  // resolves to the *browser* client — that has no session on the server, so
  // every fetch threw and the summary silently showed 0 / "Skipped". These
  // catches degrade gracefully but log the real failure server-side.
  const [profile, goals, brands, typicalDaily, purchasePref] = await Promise.all([
    getServerProfile().catch((e) => {
      console.error('[onboarding/done] getServerProfile failed', e);
      return null;
    }),
    getServerGoals().catch((e) => {
      console.error('[onboarding/done] getServerGoals failed', e);
      return [];
    }),
    getServerBrandsWithVariants().catch((e) => {
      console.error('[onboarding/done] getServerBrandsWithVariants failed', e);
      return [];
    }),
    getServerSetting<number>('onboarding.typicalDaily').catch((e) => {
      console.error('[onboarding/done] getServerSetting(typicalDaily) failed', e);
      return null;
    }),
    getServerSetting<'single' | 'pack' | 'mixed'>('onboarding.purchasePref').catch((e) => {
      console.error('[onboarding/done] getServerSetting(purchasePref) failed', e);
      return null;
    }),
  ]);

  const baselinePerDay =
    typicalDaily ?? (profile?.baselinePerDay != null ? Number(profile.baselinePerDay) : 0);
  const baselineWindowDays = profile?.baselineWindowDays ?? 30;
  const favorites = brands.filter((b) => b.isFavorite).map((b) => b.name);
  const activeGoal = goals[0] ?? null;

  return (
    <OnboardingDoneClient
      baselinePerDay={baselinePerDay}
      baselineWindowDays={baselineWindowDays}
      purchasePref={purchasePref}
      favorites={favorites}
      goal={
        activeGoal
          ? { type: activeGoal.type, targetValue: activeGoal.targetValue, meta: activeGoal.meta }
          : null
      }
      country={profile?.country ?? null}
    />
  );
}
