'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@web/components/ui/Card';
import { Chip } from '@web/components/ui/Chip';
import { Input } from '@web/components/ui/Input';
import { Button } from '@web/components/ui/Button';
import { Text } from '@web/components/ui/Text';
import { createGoal } from '@/db/repositories/goals';
import { setOnboardingStep } from '@/db/repositories/profile';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import type { GoalType } from '@/types';
import { toSafeErrorMessage } from '@/lib/errors';

const GOAL_TYPES: { id: GoalType; label: string; hint: string }[] = [
  { id: 'daily_cap', label: 'Daily cap', hint: 'Max sticks per day' },
  { id: 'spend_cap_daily', label: 'Spend cap', hint: 'Max INR per day' },
  { id: 'reduction_target', label: 'Reduction target', hint: 'Percent reduction' },
  { id: 'no_smoke_window', label: 'No-smoke window', hint: 'Protected hours daily' },
];

export default function OnboardingGoalPage() {
  const router = useRouter();
  const [type, setType] = React.useState<GoalType | null>(null);
  const [target, setTarget] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSetGoal = async () => {
    if (!type) return;
    const parsed = Number(target);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a valid target value.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createGoal({ type, targetValue: parsed });
      await track(AnalyticsEvents.GOAL_CREATED, { type });
      await setOnboardingStep('brands');
      router.push('/onboarding/brands');
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
          STEP 2 OF 3
        </Text>
        <Text variant="display">Pick one small goal</Text>
        <Text variant="small" muted>
          Small, specific goals are easier to sustain. You can add more later.
        </Text>
      </header>

      <Card>
        <div className="flex flex-col gap-md">
          <Text variant="bodyStrong">Goal type</Text>
          <div className="flex flex-wrap gap-sm">
            {GOAL_TYPES.map((goal) => (
              <Chip
                key={goal.id}
                label={`${goal.label} - ${goal.hint}`}
                selected={type === goal.id}
                onPress={() => setType(goal.id)}
              />
            ))}
          </div>
        </div>
      </Card>

      {type ? (
        <Card>
          <Input
            label={type === 'spend_cap_daily' ? 'Target amount (INR)' : 'Target value'}
            type="number"
            min={1}
            step="0.1"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={type === 'daily_cap' ? 'e.g. 8' : 'e.g. 20'}
          />
        </Card>
      ) : null}

      {error ? (
        <Text variant="small" color="var(--danger, #C85A54)">
          {error}
        </Text>
      ) : null}

      <div className="grid grid-cols-2 gap-md">
        <Button
          title="Skip"
          variant="ghost"
          fullWidth
          disabled={submitting}
          onPress={async () => {
            try {
              await setOnboardingStep('brands');
            } catch {
              // The middleware will still let them through; non-fatal here.
            }
            router.push('/onboarding/brands');
          }}
        />
        <Button
          title={submitting ? 'Saving…' : 'Set goal'}
          fullWidth
          disabled={!type || !target || submitting}
          loading={submitting}
          onPress={onSetGoal}
        />
      </div>
    </div>
  );
}
