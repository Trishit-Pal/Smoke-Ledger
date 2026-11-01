import * as React from 'react';

interface Step {
  num: string;
  title: string;
  hint: string;
  example: string;
}

const STEPS: Step[] = [
  {
    num: 'I.',
    title: 'Begin',
    hint: 'Sign up free, confirm your email, accept the privacy consents.',
    example: 'e.g. you@example.com',
  },
  {
    num: 'II.',
    title: 'Log',
    hint: 'One tap, brand inferred. Edit later if needed.',
    example: 'e.g. Gold Flake · 3:14 pm',
  },
  {
    num: 'III.',
    title: 'Read',
    hint: 'The dashboard fills as days do. The week, month, year — in one read.',
    example: 'e.g. 7-day avg: 8.4 / day',
  },
];

export function LandingHowItWorks() {
  return (
    <section
      aria-labelledby="landing-how-heading"
      style={{
        padding: 'clamp(56px, 8vw, 96px) clamp(20px, 5vw, 64px)',
        background: 'transparent',
        borderTop: '1px solid var(--rule)',
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
          <span className="editorial-caption">How it reads</span>
          <h2
            id="landing-how-heading"
            className="editorial-headline"
            style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', margin: 0 }}
          >
            Three <span style={{ color: 'var(--accent-ink)', fontStyle: 'italic' }}>small</span> steps.
          </h2>
        </header>

        <ol
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
            gap: 16,
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}
        >
          {STEPS.map((step) => (
            <li
              key={step.num}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--rule)',
                borderRadius: 14,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minHeight: 180,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  color: 'var(--accent-ink)',
                  fontStyle: 'italic',
                  lineHeight: 1,
                  fontWeight: 500,
                }}
              >
                {step.num}
              </span>
              <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
                {step.title}
              </span>
              <span
                style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, flex: 1 }}
              >
                {step.hint}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 12,
                  color: 'var(--text-faint)',
                  marginTop: 'auto',
                }}
              >
                {step.example}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
