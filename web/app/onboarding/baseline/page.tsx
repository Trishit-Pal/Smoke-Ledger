'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@web/components/ui/Card';
import { Chip } from '@web/components/ui/Chip';
import { Input } from '@web/components/ui/Input';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { getSetting } from '@/db/repositories/settings';
import { updateProfile, setOnboardingStep } from '@/db/repositories/profile';
import { toSafeErrorMessage } from '@/lib/errors';

export default function OnboardingBaselinePage() {
  const router = useRouter();
  const [perDay, setPerDay] = React.useState('');
  const [windowDays, setWindowDays] = React.useState<7 | 30>(30);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      const value = await getSetting<number>('onboarding.typicalDaily');
      if (value != null) {
        setPerDay(String(value));
      }
    })();
  }, []);

  const onContinue = async () => {
    const parsed = Number(perDay);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid baseline value.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateProfile({
        baselinePerDay: parsed,
        baselineWindowDays: windowDays,
      });
      await setOnboardingStep('goal');
      router.push('/onboarding/goal');
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
          STEP 2 OF 4
        </Text>
        <Text variant="display">Set your baseline</Text>
        <Text variant="small" muted>
          We compare progress against this baseline. You can update it later.
        </Text>
      </header>

      <Card>
        <div className="flex flex-col gap-md">
          <Input
            label="Baseline - sticks per day"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={perDay}
            onChange={(e) => setPerDay(e.target.value)}
            placeholder="e.g. 10"
          />
          <div className="flex flex-col gap-sm">
            <Text variant="caption" muted>
              Comparison window
            </Text>
            <div className="flex gap-sm">
              <Chip label="7 days" selected={windowDays === 7} onPress={() => setWindowDays(7)} />
              <Chip
                label="30 days"
                selected={windowDays === 30}
                onPress={() => setWindowDays(30)}
              />
            </div>
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
        disabled={!perDay || submitting}
        loading={submitting}
        onPress={onContinue}
      />
    </div>
  );
}
