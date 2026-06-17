import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Card } from '@/components/ui/Card';
import { PaperNoise } from '@/components/ui/PaperNoise';
import { FadeSlideIn } from '@/components/anim/FadeSlideIn';
import { Tilt } from '@/components/anim/Tilt';
import { Pulse } from '@/components/anim/Pulse';
import { ConfettiBurst } from '@/components/character/ConfettiBurst';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useAuth } from '@/store/auth';

interface Pillar {
  roman: string;
  title: string;
  copy: string;
}

const PILLARS: Pillar[] = [
  { roman: 'I.', title: 'Free', copy: 'No ads, no upsell, no subscription tier.' },
  { roman: 'II.', title: 'Private', copy: 'Encrypted at rest. Yours to export or delete.' },
  { roman: 'III.', title: 'Honest', copy: 'No streaks. No badges. No shame patterns.' },
];

export default function Welcome() {
  const router = useRouter();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const setJustCreated = useAuth((s) => s.setJustCreated);
  // Read the one-shot flag once at mount (lazy initializer) so it stays true for
  // this mount even after we clear the store flag below.
  const [celebrate] = React.useState(() => useAuth.getState().justCreated);

  React.useEffect(() => {
    if (celebrate) setJustCreated(false); // clear so re-entry doesn't replay it
  }, [celebrate, setJustCreated]);

  return (
    <Screen>
      {celebrate ? <ConfettiBurst active={!reduceMotion} /> : null}

      {/* Step caption */}
      <FadeSlideIn index={0} delay={40}>
        <Text variant="caption" color={theme.textFaint} style={{ letterSpacing: 1.5 }}>
          AN HONEST TRACKER · ESTABLISHED 2026
        </Text>
      </FadeSlideIn>

      {/* Editorial headline */}
      <FadeSlideIn index={1}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="display" style={{ lineHeight: 34 }}>
            Know every stick.{'\n'}
            Spend less.{'\n'}
            <Text variant="display" color={theme.accent} style={{ fontStyle: 'italic', lineHeight: 34 }}>
              Quit on your terms.
            </Text>
          </Text>
        </View>
      </FadeSlideIn>

      {/* Hairline rule */}
      <FadeSlideIn index={2}>
        <View style={{ width: 60 }}>
          <Divider strong />
        </View>
      </FadeSlideIn>

      {/* Body copy */}
      <FadeSlideIn index={3}>
        <Text variant="body" muted>
          Smoke Ledger is a private, observational record of your smoking — not a streak
          game, not a guilt machine. We'll set this up in four small steps. About ninety
          seconds.
        </Text>
      </FadeSlideIn>

      {/* CTA */}
      <FadeSlideIn index={4}>
        <Pulse active>
          <Button
            title="Begin the ledger →"
            fullWidth
            size="lg"
            onPress={() => router.push('/onboarding/privacy')}
          />
        </Pulse>
      </FadeSlideIn>

      {/* Pillar cards */}
      <FadeSlideIn index={5}>
        <View style={{ gap: spacing.sm }}>
          {PILLARS.map((p) => (
            <Tilt key={p.roman} maxDeg={5}>
              <Card style={{ position: 'relative', overflow: 'hidden' }}>
                <PaperNoise />
                <View style={{ gap: spacing.xs }}>
                  <Text
                    variant="h1"
                    color={theme.accent}
                    style={{ fontStyle: 'italic', fontSize: 28, lineHeight: 30 }}
                  >
                    {p.roman}
                  </Text>
                  <Text variant="bodyStrong">{p.title}</Text>
                  <Text variant="small" muted>
                    {p.copy}
                  </Text>
                </View>
              </Card>
            </Tilt>
          ))}
        </View>
      </FadeSlideIn>
    </Screen>
  );
}
