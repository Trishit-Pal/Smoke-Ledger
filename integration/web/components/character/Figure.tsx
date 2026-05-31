'use client';

/*
 * Figure — minimal geometric stick-figure with 8 mood animations.
 *
 * Pure SVG + CSS keyframes (no Framer Motion, no Lottie). Animations live in
 * web/components/character/character-animations.css which must be imported
 * once at the app root (already imported via globals.css in this integration).
 *
 * Sizing: viewBox is 200×240 so the natural aspect ratio is 5:6. Pass `size`
 * in px (width); height auto-scales. Default 160px.
 *
 * Reduced motion: a global media query in character-animations.css disables
 * every animation under prefers-reduced-motion. The figure stays visible with
 * a neutral resting pose.
 */

import * as React from 'react';
import type { Mood } from '@web/lib/character/mood';

export interface FigureProps {
  mood?: Mood;
  /** Width in px. Height auto-scales to 1.2× width. */
  size?: number;
  /** Stroke width for the ink lines. Default 2.4. */
  stroke?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Figure({
  mood = 'greet',
  size = 160,
  stroke = 2.4,
  className,
  style,
}: FigureProps) {
  const showSmoke   = mood === 'regret';
  const showThumb   = mood === 'thumb';
  const showRibs    = mood === 'breathe';
  const showBreath  = mood === 'breathe';
  const showFlecks  = mood === 'applaud';

  return (
    <svg
      className={`character-fig character-fig-mood-${mood}${className ? ` ${className}` : ''}`}
      viewBox="0 0 200 240"
      width={size}
      height={size * 1.2}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {showFlecks && (
        <g className="flecks">
          {[
            { x: 40,  y: 20, c: 'accent', d: '0s'  , w: 2, h: 8 },
            { x: 70,  y: 10, c: 'ink',    d: '.3s' , w: 2, h: 6 },
            { x: 105, y: 22, c: 'accent', d: '.6s' , w: 2, h: 8 },
            { x: 140, y: 14, c: 'ink',    d: '.9s' , w: 2, h: 6 },
            { x: 160, y: 26, c: 'accent', d: '1.2s', w: 2, h: 8 },
            { x: 25,  y: 30, c: 'ink',    d: '1.5s', w: 2, h: 6 },
          ].map((f, i) => (
            <rect
              key={i}
              className={`fleck fill ${f.c === 'accent' ? 'accent' : ''}`}
              x={f.x}
              y={f.y}
              width={f.w}
              height={f.h}
              style={{
                animationDelay: f.d,
                transformOrigin: `${f.x + f.w / 2}px ${f.y + f.h / 2}px`,
              }}
            />
          ))}
        </g>
      )}

      <g className="figure-root">
        <g className="head">
          <circle className="stroke" cx="100" cy="50" r="22" strokeWidth={stroke} />
          <g className="eyes">
            <circle className="fill" cx="92" cy="48" r="2" />
            <circle className="fill" cx="108" cy="48" r="2" />
          </g>
          {mood === 'greet'   && <path className="stroke" d="M 92 58 Q 100 62 108 58" strokeWidth={stroke - 0.4} />}
          {mood === 'regret'  && <path className="stroke" d="M 92 60 Q 100 56 108 60" strokeWidth={stroke - 0.4} />}
          {mood === 'thumb'   && <path className="stroke" d="M 93 58 Q 100 63 107 58" strokeWidth={stroke - 0.4} />}
          {mood === 'applaud' && <path className="stroke" d="M 90 57 Q 100 64 110 57" strokeWidth={stroke - 0.4} />}
          {mood === 'victory' && <path className="stroke" d="M 90 56 Q 100 64 110 56" strokeWidth={stroke - 0.4} />}
          {mood === 'breathe' && <circle className="stroke" cx="100" cy="59" r="2.5" strokeWidth={stroke - 0.6} />}
          {mood === 'concern' && <path className="stroke" d="M 93 60 L 107 60" strokeWidth={stroke - 0.4} />}
          {mood === 'bye'     && <path className="stroke" d="M 92 58 Q 100 62 108 58" strokeWidth={stroke - 0.4} />}
        </g>

        <g className="torso-grp">
          <line className="stroke" x1="100" y1="72" x2="100" y2="150" strokeWidth={stroke} />

          {showRibs && (
            <g className="ribs">
              <path className="stroke accent" d="M 88 92 Q 100 96 112 92" strokeWidth={stroke - 0.8} opacity="0.6" />
              <path className="stroke accent" d="M 86 104 Q 100 108 114 104" strokeWidth={stroke - 0.8} opacity="0.5" />
              <path className="stroke accent" d="M 88 116 Q 100 120 112 116" strokeWidth={stroke - 0.8} opacity="0.4" />
            </g>
          )}

          <g className="arm-l">
            <line className="stroke" x1="100" y1="85" x2="70" y2="130" strokeWidth={stroke} />
          </g>
          <g className="arm-r">
            <line className="stroke" x1="100" y1="85" x2="130" y2="130" strokeWidth={stroke} />
            {showSmoke && (
              <g>
                <line className="stroke" x1="130" y1="130" x2="142" y2="128" strokeWidth={stroke - 0.6} />
                <circle className="ember" cx="143" cy="128" r="2" />
              </g>
            )}
            {showThumb && (
              <g className="thumb">
                <circle className="fill accent" cx="130" cy="128" r="3.5" />
                <rect className="fill accent" x="128" y="118" width="4" height="8" rx="2" />
              </g>
            )}
          </g>

          <line className="stroke" x1="100" y1="150" x2="80"  y2="220" strokeWidth={stroke} />
          <line className="stroke" x1="100" y1="150" x2="120" y2="220" strokeWidth={stroke} />
        </g>

        {showSmoke && (
          <g>
            <circle className="stroke warn smoke s1" cx="143" cy="128" r="3" strokeWidth="1" opacity="0" />
            <circle className="stroke warn smoke s2" cx="143" cy="128" r="3" strokeWidth="1" opacity="0" />
            <circle className="stroke warn smoke s3" cx="143" cy="128" r="3" strokeWidth="1" opacity="0" />
          </g>
        )}

        {showBreath && (
          <g>
            <circle className="stroke accent breath b1" cx="108" cy="40" r="2" strokeWidth="1" opacity="0" />
            <circle className="stroke accent breath b2" cx="108" cy="40" r="2" strokeWidth="1" opacity="0" />
            <circle className="stroke accent breath b3" cx="108" cy="40" r="2" strokeWidth="1" opacity="0" />
          </g>
        )}
      </g>
    </svg>
  );
}

export default Figure;
