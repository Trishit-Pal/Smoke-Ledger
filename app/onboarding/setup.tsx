import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { spacing } from '@/constants/theme';
import { setSetting } from '@/db/repositories/settings';

const DAILY_BUCKETS = [
  { id: 'lt5', label: '< 5', value: 3 },
  { id: '5_10', label: '5–10', value: 7 },
  { id: '10_15', label: '10–15', value: 12 },
  { id: '15_20', label: '15–20', value: 17 },
  { id: 'gt20', label: '20+', value: 22 },
];

const PURCHASE_PREF = [
  { id: 'single', label: 'Mostly singles' },
  { id: 'pack', label: 'Mostly packs' },
  { id: 'mixed', label: 'Mix of both' },
];

export default function Setup() {
  const router = useRouter();
  const [daily, setDaily] = useState<string | null>(null);
  const [pref, setPref] = useState<string | null>(null);

  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <FadeSlideIn index={0}>
          <Text variant="h1">A couple of quick questions</Text>
        </FadeSlideIn>

        <FadeSlideIn index={1}>
          <Text variant="body" muted>
            Rough answers are fine — you can change these anytime.
          </Text>
        </FadeSlideIn>

        <FadeSlideIn index={2}>
          <Card>
            <View style={{ gap: spacing.md }}>
              <Text variant="bodyStrong">About how many a day right now?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {DAILY_BUCKETS.map((b) => (
                  <Chip
                    key={b.id}
                    label={b.label}
                    selected={daily === b.id}
                    onPress={() => setDaily(b.id)}
                  />
                ))}
              </View>
            </View>
          </Card>
        </FadeSlideIn>

        <FadeSlideIn index={3}>
          <Card>
            <View style={{ gap: spacing.md }}>
              <Text variant="bodyStrong">How do you usually buy?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {PURCHASE_PREF.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.label}
                    selected={pref === p.id}
                    onPress={() => setPref(p.id)}
                  />
                ))}
              </View>
            </View>
          </Card>
        </FadeSlideIn>

        <FadeSlideIn index={4}>
          <Button
            title="Continue"
            fullWidth
            size="lg"
            disabled={!daily || !pref}
            onPress={async () => {
              const bucket = DAILY_BUCKETS.find((b) => b.id === daily);
              if (bucket) await setSetting('onboarding.typicalDaily', bucket.value);
              if (pref) await setSetting('onboarding.purchasePref', pref);
              router.push('/onboarding/baseline');
            }}
          />
        </FadeSlideIn>
      </View>
    </Screen>
  );
}
