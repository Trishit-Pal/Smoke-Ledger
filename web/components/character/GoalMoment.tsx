'use client';

/*
 * GoalMoment — a single restrained editorial overlay for two goal moments:
 *   - completion: the figure applauds, "Well kept." (congratulation, never confetti)
 *   - deletion:   the figure breathes, "No judgment." (sentiment for a goal let go)
 *
 * Modelled on LogoutFarewell, but the goals page doesn't navigate after the
 * action, so this self-dismisses on a timer (and on click). Mounted once in the
 * (app) layout; renders nothing until an event fires.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Figure } from '@web/components/character/Figure';
import {
  CHARACTER_GOAL_COMPLETION_EVENT,
  CHARACTER_GOAL_DELETION_EVENT,
  type GoalMomentDetail,
} from '@web/lib/character/mood';

const DISMISS_MS = 2600;

type Moment = { kind: 'completion' | 'deletion'; title: string; body: string };

export function GoalMoment() {
  const [moment, setMoment] = React.useState<Moment | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    function show(kind: Moment['kind'], e: Event) {
      const detail = (e as CustomEvent<GoalMomentDetail>).detail;
      if (!detail) return;
      setMoment({ kind, title: detail.title, body: detail.body });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMoment(null), DISMISS_MS);
    }
    const onComplete = (e: Event) => show('completion', e);
    const onDelete = (e: Event) => show('deletion', e);
    window.addEventListener(CHARACTER_GOAL_COMPLETION_EVENT, onComplete);
    window.addEventListener(CHARACTER_GOAL_DELETION_EVENT, onDelete);
    return () => {
      window.removeEventListener(CHARACTER_GOAL_COMPLETION_EVENT, onComplete);
      window.removeEventListener(CHARACTER_GOAL_DELETION_EVENT, onDelete);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!mounted || !moment) return null;
  const isCompletion = moment.kind === 'completion';

  const node = (
    <div
      className="character-overlay"
      role="status"
      aria-live="polite"
      onClick={() => setMoment(null)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-elevated)',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 32,
        cursor: 'pointer',
      }}
    >
      <div className="paper-noise" style={{ position: 'absolute', inset: 0 }} aria-hidden />
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Figure mood={isCompletion ? 'applaud' : 'breathe'} size={200} />
      </div>
      <span className="editorial-caption">{isCompletion ? 'Goal complete' : 'Goal set aside'}</span>
      <h2
        className="editorial-headline"
        style={{ fontSize: 40, textAlign: 'center', margin: '4px 0 0', color: 'var(--text)', position: 'relative' }}
      >
        {moment.title}
      </h2>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          maxWidth: 320,
          textAlign: 'center',
          lineHeight: 1.6,
          marginTop: 4,
          position: 'relative',
        }}
      >
        {moment.body}
      </p>
      <div style={{ width: 80, borderTop: '1px solid var(--rule)', marginTop: 18, position: 'relative' }} />
    </div>
  );

  return createPortal(node, document.body);
}

export default GoalMoment;
