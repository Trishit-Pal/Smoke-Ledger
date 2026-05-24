'use client';

/*
 * MilestoneCelebration — one-shot modal fired by dispatchMilestone().
 *
 * Listens for `character:milestone` events. Renders an editorial modal with
 * the applause figure + confetti burst + headline copy. Auto-dismisses after
 * 5 seconds or on any click / Escape. Also fires the masthead companion's
 * `applaud` mood in parallel, so the entire screen acknowledges the moment.
 *
 * Mount once near the app root (e.g. AppLayout) so it captures milestone
 * events from anywhere in the app.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Figure } from '@web/components/character/Figure';
import { ConfettiBurst } from '@web/components/character/ConfettiBurst';
import {
  CHARACTER_MILESTONE_EVENT,
  dispatchMood,
  type MilestoneEventDetail,
} from '@web/lib/character/mood';

const AUTO_DISMISS_MS = 5200;

export function MilestoneCelebration() {
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<MilestoneEventDetail | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const dismissTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    function handler(ev: Event) {
      const d = (ev as CustomEvent<MilestoneEventDetail>).detail;
      if (!d) return;
      setDetail(d);
      setOpen(true);
      // also fire the masthead companion
      dispatchMood('applaud', { caption: `${d.days}-day streak.`, durationMs: 3400 });
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
      dismissTimer.current = window.setTimeout(() => setOpen(false), AUTO_DISMISS_MS);
    }
    window.addEventListener(CHARACTER_MILESTONE_EVENT, handler);
    return () => {
      window.removeEventListener(CHARACTER_MILESTONE_EVENT, handler);
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!mounted || !open || !detail) return null;

  const node = (
    <div
      className="character-overlay"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="character-milestone-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 15, 20, 0.28)',
        backdropFilter: 'blur(2px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="character-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-elevated)',
          width: 440,
          maxWidth: '100%',
          padding: '32px 36px',
          boxShadow: 'var(--shadow-card)',
          position: 'relative',
          overflow: 'visible',
          borderRadius: 4,
        }}
      >
        <ConfettiBurst active />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="editorial-caption">Milestone</span>
          <span className="editorial-caption" style={{ color: 'var(--text-faint)' }}>
            Day {detail.days}
          </span>
        </div>
        <div
          style={{
            borderTop: '1px solid var(--rule-strong)',
            marginTop: 6,
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 0 12px',
          }}
        >
          <Figure mood="applaud" size={180} />
        </div>

        <h2
          id="character-milestone-title"
          className="editorial-headline"
          style={{
            fontSize: 32,
            textAlign: 'center',
            margin: '0 0 8px',
            color: 'var(--text)',
          }}
        >
          {detail.title}
        </h2>
        {detail.body ? (
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              textAlign: 'center',
              lineHeight: 1.6,
              maxWidth: 320,
              margin: '0 auto',
            }}
          >
            {detail.body}
          </p>
        ) : null}

        <div
          style={{
            borderTop: '1px solid var(--rule)',
            margin: '24px 0 16px',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="editorial-caption" style={{ color: 'var(--text-faint)' }}>
            tap anywhere to dismiss
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--text)',
              padding: '10px 18px',
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              borderRadius: 4,
            }}
          >
            Carry on
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

export default MilestoneCelebration;
