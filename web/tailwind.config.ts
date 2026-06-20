import type { Config } from 'tailwindcss';

// Import design tokens directly from the shared constants — no duplication.
const palette = {
  ink: '#0B0F14',
  inkSoft: '#11161D',
  slate900: '#1A2029',
  slate700: '#2A333F',
  slate500: '#5A6673',
  slate300: '#A9B3BF',
  slate100: '#E6EAEF',
  surface: '#F6F7F9',
  white: '#FFFFFF',
  teal: '#2FA39B',
  tealSoft: '#1F726D',
  amber: '#D99A2B',
  red: '#C85A54',
  green: '#4CAF84',
  blue: '#4C7CD9',
};

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic CSS-variable driven tokens (swap on dark mode)
        bg: 'var(--bg)',
        'bg-elevated': 'var(--bg-elevated)',
        card: 'var(--card)',
        border: 'var(--border)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-faint': 'var(--text-faint)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        // Static palette
        ink: palette.ink,
        'ink-soft': palette.inkSoft,
        success: palette.green,
        warn: palette.amber,
        danger: palette.red,
        teal: palette.teal,
        'teal-soft': palette.tealSoft,
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        xxl: '32px',
        xxxl: '48px',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        pill: '999px',
      },
      fontSize: {
        // Fluid: floor is the previous fixed 28px (phones unchanged), scaling up
        // to 34px on large desktops so the biggest in-app heading doesn't look
        // small on a wide canvas. Editorial numerals already clamp in globals.css.
        display: ['clamp(28px, 1.6rem + 0.5vw, 34px)', { fontWeight: '700', letterSpacing: '-0.3px' }],
        h1: ['22px', { fontWeight: '700', letterSpacing: '-0.2px' }],
        h2: ['18px', { fontWeight: '600' }],
        h3: ['16px', { fontWeight: '600' }],
        body: ['15px', { fontWeight: '400' }],
        'body-strong': ['15px', { fontWeight: '600' }],
        small: ['13px', { fontWeight: '400' }],
        caption: ['12px', { fontWeight: '500', letterSpacing: '0.2px' }],
        mono: ['14px', { fontWeight: '500' }],
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      animation: {
        pulse: 'pulse 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
