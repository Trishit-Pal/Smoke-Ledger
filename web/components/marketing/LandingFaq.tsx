import * as React from 'react';

interface FaqItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Is Smoke Ledger really free?',
    a: 'Yes. Core tracking, trends, and export are free. We do not run ads or sell your data.',
  },
  {
    q: 'Is my data private?',
    a: 'Your logs are protected by authentication and row-level security. Only you can access your account data.',
  },
  {
    q: 'Is this medical advice?',
    a: 'No. Smoke Ledger is behavioral support software for adults 18+. Consult a licensed clinician for medical decisions.',
  },
];

export function LandingFaq() {
  return (
    <section
      aria-labelledby="landing-faq-heading"
      style={{
        padding: 'clamp(56px, 8vw, 96px) clamp(20px, 5vw, 64px)',
        background: 'transparent',
        borderTop: '1px solid var(--rule)',
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="editorial-caption">Frequently asked</span>
          <h2
            id="landing-faq-heading"
            className="editorial-headline"
            style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', margin: 0 }}
          >
            Quiet <span style={{ color: 'var(--accent-ink)', fontStyle: 'italic' }}>answers</span>.
          </h2>
        </header>

        <div
          style={{
            borderTop: '1px solid var(--rule-strong)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {FAQ_ITEMS.map((item, i) => (
            <article
              key={item.q}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr',
                gap: 16,
                padding: '20px 0',
                borderBottom: '1px solid var(--rule)',
                alignItems: 'baseline',
              }}
            >
              <span
                className="editorial-caption-tight nums-tabular"
                style={{ color: 'var(--text-faint)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--text)',
                  }}
                >
                  {item.q}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: 'var(--text-muted)',
                    lineHeight: 1.6,
                  }}
                >
                  {item.a}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
