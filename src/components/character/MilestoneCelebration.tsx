// MilestoneCelebration — one-shot streak modal (RN port).
//
// Listens for `character:milestone` events. Renders an editorial Modal with
// the applause figure + confetti burst + headline copy. Auto-dismisses after
// 5.2s or on tap. Also fires the masthead companion's `applaud` mood in
// parallel so the entire screen acknowledges the moment.
//
// Mount ONCE near the app root (app/_layout.tsx) so it captures events from
// anywhere in the app.

import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Figure } from './Figure';
import { ConfettiBurst } from './ConfettiBurst';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { fonts, radius, spacing } from '@/constants/theme';
import {
  dispatchMood,
  onMilestone,
  type MilestoneEventDetail,
} from '@/lib/character/mood';

const AUTO_DISMISS_MS = 5200;

export function MilestoneCelebration() {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<MilestoneEventDetail | null>(null);
  const dismissTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const sub = onMilestone((d) => {
      if (!d) return;
      setDetail(d);
      setOpen(true);
      // Fire the masthead companion in parallel — victory pose for grand milestones
      dispatchMood(d.grand ? 'victory' : 'applaud', {
        caption: d.type === 'streak' ? `${d.days}-day streak.` : 'Happy Birthday!',
        durationMs: 3400,
        celebrate: true,
      });
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => setOpen(false), AUTO_DISMISS_MS);
    });
    return () => {
      sub.remove();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  return (
    <Modal
      visible={open && !!detail}
      transparent
      animationType="fade"
      onRequestClose={() => setOpen(false)}
      accessibilityViewIsModal
    >
      <Pressable
        onPress={() => setOpen(false)}
        accessibilityLabel="Dismiss milestone"
        accessibilityRole="button"
        style={{
          flex: 1,
          backgroundColor: 'rgba(11,15,20,0.32)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        }}
      >
        {/* stop-propagation container */}
        <Pressable
          onPress={() => {
            /* swallow tap inside modal */
          }}
          style={{
            backgroundColor: theme.bgElevated,
            width: '100%',
            maxWidth: 440,
            padding: spacing.xl,
            borderRadius: radius.md,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text
              variant="caption"
              style={{ textTransform: 'uppercase', letterSpacing: 1.6, color: theme.textMuted }}
            >
              Milestone
            </Text>
            <Text variant="caption" style={{ color: theme.textFaint }}>
              {detail?.type === 'streak' ? `Day ${detail?.days ?? ''}` : ''}
            </Text>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: theme.ruleStrong, marginTop: spacing.xs }} />

          <View style={{ alignItems: 'center', paddingVertical: spacing.lg, position: 'relative' }}>
            <ConfettiBurst
              active={open && !reduced}
              seed={detail?.days ?? 0}
              count={detail?.grand ? 28 : 14}
            />
            <Figure mood={detail?.grand ? 'victory' : 'applaud'} size={140} />
          </View>

          <Text
            variant="display"
            style={{
              textAlign: 'center',
              color: theme.text,
              fontFamily: fonts.displaySoft,
              marginBottom: spacing.sm,
            }}
          >
            {detail?.title ?? ''}
          </Text>
          {detail?.body ? (
            <Text variant="small" muted style={{ textAlign: 'center', lineHeight: 20, maxWidth: 320, alignSelf: 'center' }}>
              {detail.body}
            </Text>
          ) : null}

          <View style={{ borderTopWidth: 1, borderTopColor: theme.rule, marginTop: spacing.lg }} />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: spacing.md,
            }}
          >
            <Text variant="caption" style={{ color: theme.textFaint }}>
              tap anywhere to dismiss
            </Text>
            <Button title="Carry on" variant="secondary" size="sm" onPress={() => setOpen(false)} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
