'use client';

/*
 * MilestoneOverlay — the next recovery milestone, set as a margin note in the
 * right gutter above the lungs (app pages only). A Fraunces italic label over
 * a small-caps DM Sans caption, in tokens only. It is DOM, not WebGL, so it
 * stays crisp; it sits above the page veil (z-index 2 > the veil's 1) but is
 * aria-hidden and pointer-events:none: atmosphere, never a control.
 *
 * It renders nothing for discreet readers, on the brand (`full`) surfaces, when
 * there is no entry to count from, or until the reader clock is known (so the
 * server markup is empty and hydration cannot mismatch).
 */

import * as React from 'react';

import type { SceneIntensity } from '@web/lib/sceneTier';

import { OVERLAY_ANCHOR } from './layout';
import { milestoneLine, sweepDue } from './pull';
import { cancelAirwayLight, getHomeSignals, requestAirwayLight, subscribeHomeSignals, type HomeSignals } from './sceneSignals';

const TICK_MS = 60_000;

export interface MilestoneOverlayProps {
  /** Newest log (ISO) from the server; a fresher one published by Home overrides it. */
  lastSmokeIso: string | null;
  discreet?: boolean;
  intensity?: SceneIntensity;
}

export function overlayEnabled(discreet: boolean, intensity: SceneIntensity): boolean {
  if (discreet || intensity === 'full') return false;
  return true;
}

export function MilestoneNote({ text, caption }: { text: string; caption: string }) {
  return (
    <div
      aria-hidden="true"
      className="hidden 2xl:block text-right"
      style={{
        position: 'fixed',
        bottom: OVERLAY_ANCHOR.bottom,
        right: OVERLAY_ANCHOR.right,
        width: OVERLAY_ANCHOR.width,
        zIndex: 2,
        pointerEvents: 'none',
        textWrap: 'balance',
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: '0.8125rem',
          lineHeight: 1.4,
          color: 'var(--accent-ink)',
        }}
      >
        {text}
      </p>
      <p
        style={{
          margin: '0.25rem 0 0',
          fontSize: '0.75rem',
          lineHeight: 1.4,
          letterSpacing: '0.06em',
          fontVariantCaps: 'all-small-caps',
          color: 'var(--text-faint)',
        }}
      >
        {caption}
      </p>
    </div>
  );
}

export function MilestoneOverlay({ lastSmokeIso, discreet = false, intensity = 'quiet' }: MilestoneOverlayProps) {
  const enabled = overlayEnabled(discreet, intensity);
  const [published, setPublished] = React.useState<{ iso: string | null } | null>(null);
  const [now, setNow] = React.useState<Date | null>(null);

  // Home's fresher log time. The store does not replay, so read it on subscribe; a clear
  // (Home unmounting or republishing in the same tick) lands on the next frame so it never flickers.
  React.useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const apply = (s: HomeSignals | null) => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (s) setPublished({ iso: s.lastSmokeIso });
      else raf = requestAnimationFrame(() => setPublished(null));
    };
    apply(getHomeSignals());
    const off = subscribeHomeSignals(apply);
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  // The clock: now, once a minute while the tab is visible, and on coming back to it.
  React.useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    setNow(new Date());
    const id = window.setInterval(refresh, TICK_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled]);

  // Home's log window is ~60 days: a quitter with an older last entry publishes null, so fall back.
  const iso = published?.iso ?? lastSmokeIso;
  const line = React.useMemo(() => (enabled && now ? milestoneLine(iso, now) : null), [enabled, iso, now]);
  const hasLine = line !== null;
  const reached = line?.milestoneMinutes ?? null;

  // A newly reached milestone lights the airways once; reduced motion never asks.
  React.useEffect(() => {
    if (!hasLine || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      if (sweepDue(window.sessionStorage, reached)) requestAirwayLight();
    } catch {
      // storage blocked: no sweep, the note still shows
    }
    return cancelAirwayLight; // a request nobody picked up must not outlive the overlay
  }, [hasLine, reached]);

  if (!line) return null;
  return <MilestoneNote text={line.text} caption={line.caption} />;
}
