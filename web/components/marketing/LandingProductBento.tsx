import * as React from 'react';

interface FigurePlate {
  caption: string;
  figure: string;
  label: string;
  hint: string;
}

const PLATES: FigurePlate[] = [
  {
    caption: 'I · One tap',
    figure: '01',
    label: 'Log without thinking.',
    hint: 'A single tap. Brand and time inferred. Edit later if needed.',
  },
  {
    caption: 'II · The ledger',
    figure: '365',
    label: 'A record, not a score.',
    hint: 'Every day, written. No streaks. No shame patterns. Just the line.',
  },
  {
    caption: 'III · Trends',
    figure: '₹ ₹ ₹',
    label: 'The week, the month, the year.',
    hint: 'Spend in rupees. Sticks per day. The slow mirror.',
  },
  {
    caption: 'IV · Private',
    figure: '0',
    label: 'Yours to keep or to delete.',
    hint: 'Encrypted at rest. Export as JSON. Wipe everything from Settings.',
  },
];

export function LandingProductBento() {
  return (
    <section
      aria-labelledby="landing-preview-heading"
      style={{
        padding: 'clamp(56px, 8vw, 96px) clamp(20px, 5vw, 64px)',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="editorial-caption">Product · The figures</span>
          <h2
            id="landing-preview-heading"
            className="editorial-headline"
            style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', margin: 0 }}
          >
            What you get, in four <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>plates</span>.
          </h2>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 0,
            borderTop: '1px solid var(--rule-strong)',
          }}
        >
          {PLATES.map((plate) => (
            <article
              key={plate.caption}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: '28px 24px',
                borderRight: '1px solid var(--rule)',
                borderBottom: '1px solid var(--rule)',
              }}
            >
              <span className="editorial-caption-tight">{plate.caption}</span>
              <span
                className="editorial-numeral--small"
                style={{
                  color: 'var(--accent)',
                  fontSize: 'clamp(48px, 6vw, 72px)',
                  lineHeight: 1,
                }}
              >
                {plate.figure}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 18,
                  color: 'var(--text)',
                  lineHeight: 1.4,
                }}
              >
                {plate.label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  lineHeight: 1.55,
                }}
              >
                {plate.hint}
              </span>
            </article>
          ))}
        </div>

        <span
          style={{
            fontSize: 12,
            color: 'var(--text-faint)',
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
          }}
        >
          More inside the app: goals, history, and export.
        </span>
      </div>
    </section>
  );
}
