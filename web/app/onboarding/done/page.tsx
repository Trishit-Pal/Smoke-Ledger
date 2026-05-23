import * as React from 'react';
import { getProfile } from '@/db/repositories/profile';
import { listActiveGoals } from '@/db/repositories/goals';
import { listBrands } from '@/db/repositories/brands';
import { getSetting } from '@/db/repositories/settings';
import { OnboardingDoneClient } from './OnboardingDoneClient';

export const dynamic = 'force-dynamic';

export default async function OnboardingDonePage() {
  const [profile, goals, brands, typicalDaily, purchasePref] = await Promise.all([
    getProfile().catch(() => null),
    listActiveGoals().catch(() => []),
    listBrands().catch(() => []),
    getSetting<number>('onboarding.typicalDaily').catch(() => null),
    getSetting<'single' | 'pack' | 'mixed'>('onboarding.purchasePref').catch(() => null),
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
          ? { type: activeGoal.type, targetValue: activeGoal.targetValue }
          : null
      }
    />
  );
}
