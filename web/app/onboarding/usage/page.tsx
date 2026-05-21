'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@web/components/ui/Card';
import { Chip } from '@web/components/ui/Chip';
import { Input } from '@web/components/ui/Input';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { setSetting } from '@/db/repositories/settings';
import { updateProfile, setOnboardingStep } from '@/db/repositories/profile';
import { toSafeErrorMessage } from '@/lib/errors';

const PURCHASE_PREF = [
  { id: 'single', label: 'Mostly singles' },
  { id: 'pack', label: 'Mostly packs' },
  { id: 'mixed', label: 'Mix of both' },
] as const;

export default function OnboardingUsagePage() {
  const router = useRouter();
  const [perDay, setPerDay] = React.useState('10');
  const [pref, setPref] = React.useState<string | null>(null);
  const [windowDays, setWindowDays] = React.useState<7 | 30>(30);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onContinue = async () => {
    const parsed = Number(perDay);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid daily amount.');
      return;
    }
    if (!pref) return;
    setSubmitting(true);
    setError(null);
    try {
      await Promise.all([
        setSetting('onboarding.typicalDaily', parsed),
        setSetting('onboarding.purchasePref', pref),
        updateProfile({
          baselinePerDay: parsed,
          baselineWindowDays: windowDays,
        }),
      ]);
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
          STEP 1 OF 3
        </Text>
        <Text variant="display">Your daily baseline</Text>
        <Text variant="small" muted>
          One number is enough. We use it for trends and savings—not judgment.
        </Text>
      </header>

      <Card>
        <div className="flex flex-col gap-md">
          <Text variant="bodyStrong">About how many cigarettes per day?</Text>
          <Input
            label="Sticks per day"
            type="number"
            min={0}
            max={60}
            step={1}
            inputMode="numeric"
            value={perDay}
            onChange={(e) => setPerDay(e.target.value)}
          />
          <input
            type="range"
            min={0}
            max={40}
            value={Math.min(40, Number(perDay) || 0)}
            onChange={(e) => setPerDay(e.target.value)}
            className="w-full accent-[var(--accent)]"
            aria-label="Sticks per day slider"
          />
          <div className="flex flex-col gap-sm">
            <Text variant="caption" muted>
              Compare progress over
            </Text>
            <div className="flex gap-sm">
              <Chip label="7 days" selected={windowDays === 7} onPress={() => setWindowDays(7)} />
              <Chip label="30 days" selected={windowDays === 30} onPress={() => setWindowDays(30)} />
            </div>
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
        disabled={!pref || submitting}
        loading={submitting}
        onPress={onContinue}
      />
    </div>
  );
}
