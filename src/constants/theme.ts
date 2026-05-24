// Editorial design system — ported 1:1 from the web app (web/app/globals.css +
// web/tailwind.config.ts) so the Android app shares one visual identity.
// Ink-on-paper: warm paper surfaces, near-black ink, teal accent for positive
// moments, terracotta (warn-earth) for "trending up vs baseline" cautions.
// Fonts: Fraunces (display/headlines) + DM Sans (body) are loaded in
// app/_layout.tsx and referenced via `fonts` below.

export const palette = {
  // Ink + paper neutrals (shared)
  ink:        '#0B0F14',
  inkSoft:    '#11161D',
  slate900:   '#1A2029',
  slate700:   '#2A333F',
  slate500:   '#5A6673',
  slate300:   '#A9B3BF',
  slate100:   '#E6EAEF',
  surface:    '#F6F7F9',
  white:      '#FFFFFF',

  // Editorial accents
  teal:       '#2FA39B',
  tealSoft:   '#1F726D',
  warnEarth:  '#B86A4A', // terracotta — caution, never alarm red
  amber:      '#D99A2B',
  red:        '#C85A54',
  green:      '#4CAF84',
  blue:       '#4C7CD9',

  // Data-viz series (light / dark) — mirrors --chart-series-* tokens
  chartLight: ['#2FA39B', '#B86A4A', '#4C7CD9', '#8A6FC2', '#D99A2B', '#4CAF84'] as string[],
  chartDark:  ['#38C6BB', '#E0926F', '#7AA0E0', '#B49AE0', '#E6B354', '#6FD3A6'] as string[],
} as const;

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  bg: string;
  bgElevated: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  accentGlow: string;
  success: string;
  warn: string;
  danger: string;
  // Editorial tokens
  rule: string;
  ruleStrong: string;
  warnEarth: string;
  warnEarthSoft: string;
  inkSurface: string;
  inkSurfaceText: string;
  inkSurfaceMuted: string;
  inkSurfaceRule: string;
  chart: readonly string[];
}

export const lightTheme: Theme = {
  mode:           'light',
  bg:             '#F6F7F9',
  bgElevated:     '#FFFFFF',
  card:           '#FFFFFF',
  border:         '#E1E5EB',
  text:           '#0B0F14',
  textMuted:      '#5A6673',
  textFaint:      '#A9B3BF',
  accent:         '#2FA39B',
  accentSoft:     '#E4F3F1',
  accentGlow:     'rgba(47, 163, 155, 0.25)',
  success:        '#4CAF84',
  warn:           '#D99A2B',
  danger:         '#C85A54',
  rule:           '#D6DBE2',
  ruleStrong:     '#B9C1CC',
  warnEarth:      '#B86A4A',
  warnEarthSoft:  '#F2E4DD',
  inkSurface:     '#14191F',
  inkSurfaceText: '#E6EAEF',
  inkSurfaceMuted:'#8C95A1',
  inkSurfaceRule: '#2A333F',
  chart:          palette.chartLight,
};

export const darkTheme: Theme = {
  mode:           'dark',
  bg:             '#0B0F14',
  bgElevated:     '#11161D',
  card:           '#1A2029',
  border:         '#232B35',
  text:           '#E6EAEF',
  textMuted:      '#A9B3BF',
  textFaint:      '#5A6673',
  accent:         '#2FA39B',
  accentSoft:     '#163230',
  accentGlow:     'rgba(47, 163, 155, 0.18)',
  success:        '#6FD3A6',
  warn:           '#E6B354',
  danger:         '#E0726B',
  rule:           '#2A333F',
  ruleStrong:     '#3A4452',
  warnEarth:      '#D08267',
  warnEarthSoft:  '#2B1C16',
  inkSurface:     '#E6EAEF',
  inkSurfaceText: '#0B0F14',
  inkSurfaceMuted:'#5A6673',
  inkSurfaceRule: '#C7CED8',
  chart:          palette.chartDark,
};

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  xxxl: 48,
};

// Aligned to web tailwind borderRadius scale (sm6 md10 lg14 xl20 pill999).
export const radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  xxl:  28,
  pill: 999,
};

// Font-family names registered by @expo-google-fonts in app/_layout.tsx.
// Fraunces = editorial display/headlines; DM Sans = body/UI.
export const fonts = {
  display:     'Fraunces_600SemiBold',
  displaySoft: 'Fraunces_400Regular',
  serif:       'Fraunces_400Regular',
  body:        'DMSans_400Regular',
  bodyMedium:  'DMSans_500Medium',
  bodySemibold:'DMSans_600SemiBold',
  bodyBold:    'DMSans_700Bold',
} as const;

// Type ramp aligned to web (web/tailwind.config.ts fontSize). Display + h1 use
// Fraunces; the rest use DM Sans. fontWeight is omitted where a weighted font
// family is set, so Android doesn't synthesize a faux-bold over the real glyphs.
export const typography = {
  display:    { fontFamily: fonts.display,      fontSize: 28, letterSpacing: -0.3, lineHeight: 32 },
  h1:         { fontFamily: fonts.display,      fontSize: 22, letterSpacing: -0.2, lineHeight: 27 },
  h2:         { fontFamily: fonts.bodySemibold, fontSize: 18, letterSpacing: 0,    lineHeight: 24 },
  h3:         { fontFamily: fonts.bodySemibold, fontSize: 16, letterSpacing: 0,    lineHeight: 22 },
  body:       { fontFamily: fonts.body,         fontSize: 15, letterSpacing: 0,    lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodySemibold, fontSize: 15, letterSpacing: 0,    lineHeight: 22 },
  small:      { fontFamily: fonts.body,         fontSize: 13, letterSpacing: 0,    lineHeight: 18 },
  caption:    { fontFamily: fonts.bodyMedium,   fontSize: 12, letterSpacing: 0.2,  lineHeight: 16 },
  mono:       { fontFamily: fonts.bodyMedium,   fontSize: 14, letterSpacing: 0,    lineHeight: 20 },
} as const;
