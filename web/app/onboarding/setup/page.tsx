'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@web/components/ui/Card';
import { Chip } from '@web/components/ui/Chip';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { setSetting } from '@/db/repositories/settings';
import { setOnboardingStep } from '@/db/repositories/profile';
import { toSafeErrorMessage } from '@/lib/errors';

const DAILY_BUCKETS = [
  { id: 'lt5', label: '< 5', value: 3 },
  { id: '5_10', label: '5–10', value: 7 },
  { id: '10_15', label: '10–15', value: 12 },
  { id: '15_20', label: '15–20', value: 17 },
  { id: 'gt20', label: '20+', value: 22 },
] as const;

const PURCHASE_PREF = [
  { id: 'single', label: 'Mostly singles' },
  { id: 'pack', label: 'Mostly packs' },
  { id: 'mixed', label: 'Mix of both' },
] as const;

export default function OnboardingSetupPage() {
  const router = useRouter();
  const [daily, setDaily] = React.useState<string | null>(null);
  const [pref, setPref] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onContinue = async () => {
    if (!daily || !pref) return;
    setSubmitting(true);
    setError(null);
    try {
      const bucket = DAILY_BUCKETS.find((item) => item.id === daily);
      if (bucket) {
        await setSetting('onboarding.typicalDaily', bucket.value);
      }
      await setSetting('onboarding.purchasePref', pref);
      await setOnboardingStep('baseline');
      router.push('/onboarding/baseline');
    } catch (e) {
      setError(toSafeErrorMessage(e, 'dependency_failure'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-col gap-sm">
        <Text variant="caption" muted>
          STEP 1 OF 4
        </Text>
        <Text variant="display">A quick baseline</Text>
        <Text variant="small" muted>
          Rough answers are enough. You can change these from settings later.
        </Text>
      </header>

      <Card>
        <div className="flex flex-col gap-md">
          <Text variant="bodyStrong">How many cigarettes per day right now?</Text>
          <div className="flex flex-wrap gap-sm">
            {DAILY_BUCKETS.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                selected={daily === item.id}
                onPress={() => setDaily(item.id)}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-md">
          <Text variant="bodyStrong">How do you usually buy?</Text>
          <div className="flex flex-wrap gap-sm">
            {PURCHASE_PREF.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                selected={pref === item.id}
                onPress={() => setPref(item.id)}
              />
            ))}
          </div>
        </div>
      </Card>

      {error ? (
        <Text variant="small" color="var(--danger, #C85A54)">
          {error}
        </Text>
      ) : null}

      <Button
        title={submitting ? 'Saving…' : 'Continue'}
        fullWidth
        disabled={!daily || !pref || submitting}
        loading={submitting}
        onPress={onContinue}
      />
    </div>
  );
}
