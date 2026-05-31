'use client';

/*
 * CharacterCompanion — the masthead-resident figure.
 *
 * Lives once at the top of the dashboard. Listens for character:mood window
 * events and reacts: switches the Figure's mood, optionally fires a confetti
 * burst, and surfaces an optional caption flash. Auto-resets to the resting
 * `greet` mood after `durationMs` (default 3200ms).
 *
 * Reduced-motion: the underlying Figure already collapses every animation
 * under prefers-reduced-motion, and we additionally skip the confetti.
 *
 * Mounting: drop a single instance into the dashboard masthead (or any
 * always-mounted shell). Multiple instances will all react to the same
 * events — harmless, but visually noisy. Prefer one.
 */

import * as React from 'react';
import { Figure } from '@web/components/character/Figure';
import { ConfettiBurst } from '@web/components/character/ConfettiBurst';
import {
  CHARACTER_MOOD_EVENT,
  type Mood,
  type MoodEventDetail,
} from '@web/lib/character/mood';
import { useReduceMotion } from '@web/hooks/useReduceMotion';

export interface CharacterCompanionProps {
  /** Figure size in px (width). Default 96. */
  size?: number;
  /** Initial mood. Default 'greet'. */
  initialMood?: Mood;
  /** Whether to render the caption flash under the figure. Default true. */
  showCaption?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const RESTING_MOOD: Mood = 'greet';

export function CharacterCompanion({
  size = 96,
  initialMood = RESTING_MOOD,
  showCaption = true,
  className,
  style,
}: CharacterCompanionProps) {
  const reduced = useReduceMotion();
  const [mood, setMood] = React.useState<Mood>(initialMood);
  const [caption, setCaption] = React.useState<string | null>(null);
  const [confetti, setConfetti] = React.useState(false);
  // Bumping `confettiSeed` forces ConfettiBurst to re-randomise distribution.
  const [confettiSeed, setConfettiSeed] = React.useState(0);
  const resetTimer = React.useRef<number | null>(null);
  const captionTimer = React.useRef<number | null>(null);
  const confettiTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    function handler(ev: Event) {
      const detail = (ev as CustomEvent<MoodEventDetail>).detail;
      if (!detail || !detail.mood) return;

      setMood(detail.mood);

      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(
        () => setMood(RESTING_MOOD),
        detail.durationMs ?? 3200,
      );

      if (detail.caption) {
        setCaption(detail.caption);
        if (captionTimer.current) window.clearTimeout(captionTimer.current);
        captionTimer.current = window.setTimeout(() => setCaption(null), 2600);
      }

      if (detail.celebrate && !reduced) {
        setConfettiSeed((n) => n + 1);
        setConfetti(true);
        if (confettiTimer.current) window.clearTimeout(confettiTimer.current);
        confettiTimer.current = window.setTimeout(() => setConfetti(false), 1700);
      }
    }
    window.addEventListener(CHARACTER_MOOD_EVENT, handler);
    return () => {
      window.removeEventListener(CHARACTER_MOOD_EVENT, handler);
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      if (captionTimer.current) window.clearTimeout(captionTimer.current);
      if (confettiTimer.current) window.clearTimeout(confettiTimer.current);
    };
  }, [reduced]);

  return (
    <div
      className={`character-companion${className ? ` ${className}` : ''}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        ...style,
      }}
    >
      <div style={{ position: 'relative', width: size, height: size * 1.2 }}>
        <ConfettiBurst active={confetti} seed={confettiSeed} />
        <Figure mood={mood} size={size} />
      </div>
      {showCaption && caption ? (
        <span
          role="status"
          aria-live="polite"
          className="character-companion-caption"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--accent)',
            textAlign: 'center',
            maxWidth: size * 2,
            lineHeight: 1.4,
          }}
        >
          {caption}
        </span>
      ) : null}
    </div>
  );
}

export default CharacterCompanion;
