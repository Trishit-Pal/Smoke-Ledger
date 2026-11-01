import type * as React from 'react';

export const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: 44, // PRODUCT.md touch target
  padding: '0 0 4px 0',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--rule)',
  outline: 'none',
  color: 'var(--text)',
  // Tints native control accents (date highlight, checkbox/radio) to the brand teal.
  accentColor: 'var(--accent)',
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  transition: 'border-color 160ms ease',
};

// Native <input type="date"> and <select> render their popups with the UA color
// scheme. `colorScheme: 'light dark'` makes the control follow the page's
// color-scheme (set on :root/.dark in globals.css) so the calendar/option list is
// legible in both themes. `cursor: pointer` reflects that the whole field is clickable.
export const DATE_INPUT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  colorScheme: 'light dark',
  cursor: 'pointer',
};

export const PRIMARY_CTA_STYLE: React.CSSProperties = {
  height: 48,
  padding: '0 24px',
  border: 'none',
  borderRadius: 10,
  background: 'var(--accent)',
  color: '#ffffff',
  fontFamily: 'var(--font-sans)',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  width: '100%',
  boxShadow: '0 12px 32px -8px rgba(47, 163, 155, 0.45), 0 2px 4px rgba(11, 15, 20, 0.08)',
  transition: 'transform 120ms ease, box-shadow 200ms ease, opacity 140ms ease',
};

export const SECONDARY_CTA_STYLE: React.CSSProperties = {
  height: 44,
  padding: '0 18px',
  border: '1px solid var(--rule)',
  borderRadius: 10,
  background: 'transparent',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: 14,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  width: '100%',
};
