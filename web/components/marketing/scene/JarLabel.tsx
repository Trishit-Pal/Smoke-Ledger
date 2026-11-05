'use client';

/*
 * JarLabel — "Kept: ₹…" set under the glass jar in the right gutter (app pages,
 * 1536px and wider, tall enough for the jar). DOM, not WebGL, so it stays crisp;
 * above the page veil (z-index 2 > 1), aria-hidden and pointer-events:none.
 *
 * The label is the dashboard's already-masked string (••• when totals are
 * hidden); no raw figure ever reaches it. It renders nothing for discreet
 * readers, on brand (`full`) surfaces, with no published signals or an empty
 * label, and until mounted (so the server markup is empty). It shows static
 * even where there is no canvas (reduced motion, no WebGL).
 */

import * as React from 'react';

import type { SceneIntensity } from '@web/lib/sceneTier';

import { JAR_ANCHOR } from './layout';
import { overlayEnabled } from './MilestoneOverlay';
import { getHomeSignals, subscribeHomeSignals, type HomeSignals } from './sceneSignals';

export interface JarLabelProps {
  discreet?: boolean;
  intensity?: SceneIntensity;
}

export const jarLabelEnabled = overlayEnabled;

export function JarLabelNote({ label }: { label: string }) {
  return (
    <p
      aria-hidden="true"
      // 2xl, not min-[..]: tailwind.config's raw short-landscape screen disables min-* variants.
      // The height must equal JAR_MIN_HEIGHT_PX (sceneJar.test.ts holds them together).
      className="hidden 2xl:[@media(min-height:680px)]:block text-center"
      style={{
        position: 'fixed',
        top: JAR_ANCHOR.labelTop,
        right: JAR_ANCHOR.right,
        width: JAR_ANCHOR.width,
        zIndex: 2,
        pointerEvents: 'none',
        margin: 0,
        fontSize: '0.75rem',
        lineHeight: '1.25rem',
        letterSpacing: '0.04em',
        color: 'var(--text-muted)',
      }}
    >
      {`Kept: ${label}`}
    </p>
  );
}

export function JarLabel({ discreet = false, intensity = 'quiet' }: JarLabelProps) {
  const enabled = jarLabelEnabled(discreet, intensity);
  const [label, setLabel] = React.useState<string | null>(null);

  // The store does not replay, so read it on subscribe; a clear (Home unmounting or
  // republishing in the same tick) lands on the next frame so it never flickers.
  React.useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const apply = (s: HomeSignals | null) => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (s) setLabel(s.label);
      else raf = requestAnimationFrame(() => setLabel(null));
    };
    apply(getHomeSignals());
    const off = subscribeHomeSignals(apply);
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled || label === null || label.length === 0) return null;
  return <JarLabelNote label={label} />;
}
