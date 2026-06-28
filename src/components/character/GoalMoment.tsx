// GoalMoment — restrained editorial overlay for two goal moments (RN port).
//   - completion: the figure applauds, "Well kept." (congratulation, no confetti)
//   - deletion:   the figure breathes, "No judgment." (sentiment for a goal let go)
//
// The goals screen doesn't navigate after the action, so this self-dismisses on
// a timer (and on tap). Mount ONCE near the app root.

import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Figure } from './Figure';
import { PaperNoise } from '@/components/ui/PaperNoise';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { fonts, spacing } from '@/constants/theme';
import { onGoalCompletion, onGoalDeletion, type GoalMomentDetail } from '@/lib/character/mood';

const DISMISS_MS = 2600;

type Moment = { kind: 'completion' | 'deletion'; title: string; body: string };

export function GoalMoment() {
  const theme = useTheme();
  const [moment, setMoment] = React.useState<Moment | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    function show(kind: Moment['kind'], detail: GoalMomentDetail) {
      setMoment({ kind, title: detail.title, body: detail.body });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMoment(null), DISMISS_MS);
    }
    const subC = onGoalCompletion((d) => show('completion', d));
    const subD = onGoalDeletion((d) => show('deletion', d));
    return () => {
      subC.remove();
      subD.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const isCompletion = moment?.kind === 'completion';

  return (
    <Modal
      visible={moment !== null}
      transparent={false}
      animationType="fade"
      onRequestClose={() => setMoment(null)}
      accessibilityViewIsModal
    >
      <Pressable
        onPress={() => setMoment(null)}
        accessibilityLabel={isCompletion ? 'Goal complete' : 'Goal set aside'}
        accessibilityLiveRegion="polite"
        style={{
          flex: 1,
          backgroundColor: theme.bgElevated,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
          gap: spacing.sm,
        }}
      >
        <PaperNoise />
        <Figure mood={isCompletion ? 'applaud' : 'breathe'} size={160} />
        <Text
          variant="caption"
          style={{ textTransform: 'uppercase', letterSpacing: 1.6, color: theme.textMuted }}
        >
          {isCompletion ? 'Goal complete' : 'Goal set aside'}
        </Text>
        <Text
          variant="display"
          style={{ textAlign: 'center', color: theme.text, fontFamily: fonts.displaySoft, marginTop: spacing.xs }}
        >
          {moment?.title ?? ''}
        </Text>
        <Text
          variant="small"
          muted
          style={{ textAlign: 'center', maxWidth: 320, lineHeight: 20, marginTop: spacing.xs }}
        >
          {moment?.body ?? ''}
        </Text>
        <View style={{ width: 80, borderTopWidth: 1, borderTopColor: theme.rule, marginTop: spacing.md }} />
      </Pressable>
    </Modal>
  );
}

export default GoalMoment;
