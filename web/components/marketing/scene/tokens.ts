import type * as THREE_NS from 'three';

export type ThreeNs = typeof THREE_NS;

/** Used only if a custom property is missing (SSR, or a stylesheet that failed to load). */
const FALLBACK = {
  bg: '#0B0F14',
  textMuted: '#A9B3BF',
  accent: '#2FA39B',
  warnEarth: '#D08267',
} as const;

/** Relative luminance above which the background counts as the light theme. */
const LIGHT_BG_LUMINANCE = 0.3;
/** How far the light theme pulls the ink towards black so edges read on pale grey. */
export const LIGHT_INK_DARKEN = 0.4;

export function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** The scene's palette, resolved from the live design tokens. */
export interface SceneTokens {
  bg: THREE_NS.Color;
  /** Neutral ink for glass, airways and haze (`--text-muted`, darkened on the light theme). */
  ink: THREE_NS.Color;
  accent: THREE_NS.Color;
  /** Terracotta for the sign; never red. */
  warn: THREE_NS.Color;
  isLight: boolean;
}

export function readTokens(THREE: ThreeNs): SceneTokens {
  const bg = new THREE.Color(readVar('--bg', FALLBACK.bg));
  const isLight = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b > LIGHT_BG_LUMINANCE;
  const ink = new THREE.Color(readVar('--text-muted', FALLBACK.textMuted));
  if (isLight) ink.lerp(new THREE.Color(0, 0, 0), LIGHT_INK_DARKEN);
  return {
    bg,
    ink,
    accent: new THREE.Color(readVar('--accent', FALLBACK.accent)),
    warn: new THREE.Color(readVar('--warn-earth', FALLBACK.warnEarth)),
    isLight,
  };
}
