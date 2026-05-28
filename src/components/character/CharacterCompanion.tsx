// CharacterCompanion — resident masthead figure (RN port of the web version).
//
// Listens for `character:mood` events via DeviceEventEmitter and reacts:
// switches the Figure's mood, optionally fires a confetti burst, surfaces an
// optional caption flash. Auto-resets to the resting `greet` mood after
// `durationMs` (default 3200ms). Reduce-motion gates the confetti (the Figure
// itself already pares back its idle motion).
//
// Mount ONCE near the top of the dashboard (multiple instances would react to
// the same events — harmless but noisy).

import React from 'react';
import { View } from 'react-native';
import { Figure } from './Figure';
import { ConfettiBurst } from './ConfettiBurst';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { fonts } from '@/constants/theme';
import { onMood, type Mood } from '@/lib/character/mood';

export interface CharacterCompanionProps {
  /** Figure width in px. Default 80. */
  size?: number;
  /** Initial mood. Default 'greet'. */
  initialMood?: Mood;
  /** Whether to render the caption flash under the figure. Default true. */
  showCaption?: boolean;
}

const RESTING_MOOD: Mood = 'greet';

export function CharacterCompanion({
  size = 80,
  initialMood = RESTING_MOOD,
  showCaption = true,
}: CharacterCompanionProps) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const [mood, setMood] = React.useState<Mood>(initialMood);
  const [caption, setCaption] = React.useState<string | null>(null);
  const [confetti, setConfetti] = React.useState(false);
  const [confettiSeed, setConfettiSeed] = React.useState(0);
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const sub = onMood((detail) => {
      if (!detail || !detail.mood) return;
      setMood(detail.mood);

      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setMood(RESTING_MOOD), detail.durationMs ?? 3200);

      if (detail.caption) {
        setCaption(detail.caption);
        if (captionTimer.current) clearTimeout(captionTimer.current);
        captionTimer.current = setTimeout(() => setCaption(null), 2600);
      }

      if (detail.celebrate && !reduce) {
        setConfettiSeed((n) => n + 1);
        setConfetti(true);
        if (confettiTimer.current) clearTimeout(confettiTimer.current);
        confettiTimer.current = setTimeout(() => setConfetti(false), 1700);
      }
    });
    return () => {
      sub.remove();
      if (resetTimer.current) clearTimeout(resetTimer.current);
      if (captionTimer.current) clearTimeout(captionTimer.current);
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
    };
  }, [reduce]);

  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ width: size, height: size * 1.2, position: 'relative' }}>
        <ConfettiBurst active={confetti} seed={confettiSeed} />
        <Figure mood={mood} size={size} />
      </View>
      {showCaption && caption ? (
        <Text
          variant="caption"
          accessibilityLiveRegion="polite"
          style={{
            fontFamily: fonts.displaySoft,
            fontStyle: 'italic',
            color: theme.accent,
            textAlign: 'center',
            maxWidth: size * 2.4,
          }}
        >
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
