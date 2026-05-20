// Singularity design system — futuristic, electric, precise.
// Dark-first with deep space blacks + electric cyan; light is clinical & refined.

export const palette = {
  // Dark backgrounds — layered depth
  void:       '#050A0F',
  abyss:      '#0A1420',
  deep:       '#0F1C2C',
  navyBorder: '#1A2D3D',

  // Light backgrounds
  cloud:      '#F0F5F9',
  white:      '#FFFFFF',

  // Neutrals
  slate600: '#2E4A5A',
  slate500: '#6A92A8',
  slate300: '#A0BACE',
  slate100: '#D8EAEF',

  // Electric accents
  cyan:     '#00CFC0',
  cyanDeep: '#007A72',
  cyanSoft: '#00322E',
  cyanGlow: '#00CFC026',

  // Semantic
  green:  '#00E07A',
  amber:  '#F5B938',
  red:    '#FF5252',
  greenL: '#00874A',
  amberL: '#B87800',
  redL:   '#C52A2A',

  // Charts — vivid, distinct
  chartDark:  ['#00CFC0', '#4D8EF7', '#F5B938', '#FF6B6B', '#A078F5', '#00E07A', '#6A92A8'] as string[],
  chartLight: ['#007A72', '#1565C0', '#B87800', '#C52A2A', '#6B3FA0', '#00874A', '#5A7A96'] as string[],
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
  chart: readonly string[];
}

export const darkTheme: Theme = {
  mode:        'dark',
  bg:          palette.void,
  bgElevated:  palette.abyss,
  card:        palette.deep,
  border:      palette.navyBorder,
  text:        palette.slate100,
  textMuted:   palette.slate500,
  textFaint:   palette.slate600,
  accent:      palette.cyan,
  accentSoft:  palette.cyanSoft,
  accentGlow:  palette.cyanGlow,
  success:     palette.green,
  warn:        palette.amber,
  danger:      palette.red,
  chart:       palette.chartDark,
};

export const lightTheme: Theme = {
  mode:        'light',
  bg:          palette.cloud,
  bgElevated:  palette.white,
  card:        palette.white,
  border:      '#D0DDE8',
  text:        '#0A1929',
  textMuted:   '#5A7A96',
  textFaint:   '#A0BACE',
  accent:      palette.cyanDeep,
  accentSoft:  '#E0F4F2',
  accentGlow:  '#007A7215',
  success:     palette.greenL,
  warn:        palette.amberL,
  danger:      palette.redL,
  chart:       palette.chartLight,
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

export const radius = {
  sm:   6,
  md:   12,
  lg:   16,
  xl:   22,
  xxl:  28,
  pill: 999,
};

export const typography = {
  display:    { fontSize: 30, fontWeight: '800' as const, letterSpacing: -1.2 },
  h1:         { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.7 },
  h2:         { fontSize: 19, fontWeight: '600' as const, letterSpacing: -0.3 },
  h3:         { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.1 },
  body:       { fontSize: 15, fontWeight: '400' as const, letterSpacing: 0 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, letterSpacing: 0 },
  small:      { fontSize: 13, fontWeight: '400' as const, letterSpacing: 0 },
  caption:    { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8 },
  mono:       { fontSize: 14, fontWeight: '600' as const, letterSpacing: 0.3 },
};
