// onboarding-steps.jsx
// Atoms + step screens for the Smoke Ledger onboarding prototype.
// Editorial design language lifted from web/app/globals.css.

const { useState, useEffect, useMemo, useRef } = React;

/* ──────────────────────────────────────────────────────────────────────────
   ATOMS
   ────────────────────────────────────────────────────────────────────── */

function Button({ children, onClick, variant = 'primary', size = 'md', disabled, fullWidth, type = 'button' }) {
  const base = {
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 140ms ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    opacity: disabled ? 0.45 : 1,
    width: fullWidth ? '100%' : undefined,
  };
  const sizes = {
    sm: { height: 36, padding: '0 14px', fontSize: 13 },
    md: { height: 44, padding: '0 20px', fontSize: 14 },
    lg: { height: 52, padding: '0 28px', fontSize: 15 },
  };
  const variants = {
    primary: { background: 'var(--accent)', color: '#fff' },
    secondary: { background: 'var(--accent-soft)', color: 'var(--accent)' },
    ghost: { background: 'transparent', color: 'var(--text)', border: '1px solid var(--rule)' },
    ink: { background: 'var(--ink-surface)', color: 'var(--ink-surface-text)' },
  };
  return (
    <button
      type={type}
      className="focus-ring"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant] }}
    >
      {children}
    </button>
  );
}

function Chip({ children, selected, onClick, size = 'md' }) {
  const sizes = {
    sm: { height: 28, padding: '0 12px', fontSize: 12 },
    md: { height: 34, padding: '0 14px', fontSize: 13 },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring"
      style={{
        ...sizes[size],
        borderRadius: 999,
        border: selected ? '1px solid var(--accent)' : '1px solid var(--rule)',
        background: selected ? 'var(--accent-soft)' : 'var(--bg-elevated)',
        color: selected ? 'var(--accent)' : 'var(--text-muted)',
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 140ms ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
    </button>
  );
}

function Caption({ children, style }) {
  return <span className="editorial-caption" style={style}>{children}</span>;
}

function Hairline({ strong, style }) {
  return (
    <div
      style={{
        borderTop: `1px solid var(--${strong ? 'rule-strong' : 'rule'})`,
        width: '100%',
        ...style,
      }}
    />
  );
}

function Field({ label, hint, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <span className="editorial-caption-tight">{label}</span>}
      {children}
      {(hint || error) && (
        <span style={{ fontSize: 12, color: error ? 'var(--danger)' : 'var(--text-muted)' }}>
          {error || hint}
        </span>
      )}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', autoFocus, leftAdornment, rightAdornment, inputMode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 44,
        padding: '0 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--rule)',
        borderRadius: 8,
        transition: 'border-color 140ms',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
    >
      {leftAdornment && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{leftAdornment}</span>}
      <input
        autoFocus={autoFocus}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--text)',
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
          minWidth: 0,
        }}
      />
      {rightAdornment && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{rightAdornment}</span>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   STEP 0 — WELCOME
   Editorial masthead beat. No real form — just the brand promise.
   ────────────────────────────────────────────────────────────────────── */

function StepWelcome({ onContinue }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div className="stage" style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 640, position: 'relative' }}>
      {/* Background watermark numeral — barely visible, slowly drifts */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -40,
          right: -80,
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontWeight: 300,
          fontSize: 360,
          color: 'var(--rule)',
          opacity: 0.5,
          lineHeight: 0.85,
          pointerEvents: 'none',
          letterSpacing: '-0.06em',
          userSelect: 'none',
          transform: 'translateZ(0)',
          animation: 'driftSlow 18s ease-in-out infinite',
        }}
      >
        №.01
      </div>

      <div style={{ '--ed-index': 0, position: 'relative' }}>
        <Caption>An honest tracker · Established 2026</Caption>
      </div>

      <div style={{ '--ed-index': 1, position: 'relative' }}>
        <h1
          className="editorial-headline"
          style={{ fontSize: 'clamp(40px, 5.5vw, 64px)', margin: 0, color: 'var(--text)' }}
        >
          Know every stick.
          <br />
          Spend less.
          <br />
          <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Quit on your terms.</span>
        </h1>
      </div>

      <div
        className="rule-draw"
        style={{ '--ed-index': 2, borderTop: '1px solid var(--rule-strong)', width: 80, position: 'relative' }}
      />

      <div style={{ '--ed-index': 3, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0, maxWidth: 520 }}>
          Smoke Ledger is a private, observational record of your smoking — not a streak game, not a
          guilt machine. We&rsquo;ll set this up in four small steps. About ninety seconds.
        </p>
      </div>

      <div style={{ '--ed-index': 4, display: 'flex', gap: 16, alignItems: 'center', position: 'relative' }}>
        <button
          type="button"
          onClick={onContinue}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          className="focus-ring"
          style={{
            height: 56,
            padding: '0 28px',
            border: 'none',
            cursor: 'pointer',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 10,
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: '0.01em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            transform: pressed ? 'translateY(2px) scale(0.98)' : 'translateY(0) scale(1)',
            boxShadow: pressed
              ? '0 2px 8px rgba(47, 163, 155, 0.3)'
              : '0 12px 32px -8px rgba(47, 163, 155, 0.45), 0 2px 4px rgba(11, 15, 20, 0.08)',
            transition: 'transform 120ms ease-out, box-shadow 240ms',
          }}
        >
          Begin the ledger
          <span aria-hidden style={{ display: 'inline-block', transition: 'transform 200ms', fontSize: 18 }}>
            →
          </span>
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
          ↵ ENTER
        </span>
      </div>

      <div
        style={{
          '--ed-index': 5,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 18,
          marginTop: 16,
          paddingTop: 24,
          borderTop: '1px solid var(--rule)',
          position: 'relative',
          transformStyle: 'preserve-3d',
          perspective: 1000,
        }}
      >
        {[
          ['I.', 'Free', 'No ads, no upsell, no subscription tier.'],
          ['II.', 'Private', 'Encrypted at rest. Yours to export or delete.'],
          ['III.', 'Honest', 'No streaks. No badges. No shame patterns.'],
        ].map(([num, title, copy], i) => (
          <TiltCard
            key={num}
            max={8}
            lift={10}
            glare
            style={{
              padding: '18px 16px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--rule)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              animationDelay: `${i * 80 + 600}ms`,
              animationName: 'pillarRise',
              animationDuration: '700ms',
              animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
              animationFillMode: 'both',
            }}
          >
            <span
              className="editorial-numeral"
              style={{
                fontSize: 32,
                color: 'var(--accent)',
                lineHeight: 1,
                fontStyle: 'italic',
                fontWeight: 500,
              }}
            >
              {num}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{copy}</span>
          </TiltCard>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   STEP 1 — PRIVACY & CONSENT
   ────────────────────────────────────────────────────────────────────── */

function StepPrivacy({ value, onChange, onContinue, onBack }) {
  const required = [
    {
      id: 'age',
      label: 'I confirm I am 18 or older.',
      sub: 'Smoke Ledger is for adults. Required by law.',
    },
    {
      id: 'terms',
      label: 'I agree to the Terms of Service.',
      link: 'Terms of Service',
    },
    {
      id: 'privacy',
      label: 'I acknowledge the Privacy Policy.',
      link: 'Privacy Policy',
    },
    {
      id: 'medical',
      label: 'I understand this app does not provide medical advice.',
      sub: 'For health decisions, please consult a clinician.',
    },
    {
      id: 'dataProcessing',
      label: 'I consent to processing my data for account, sync, and security.',
    },
  ];

  const canContinue = required.every((r) => value[r.id]);
  const toggle = (id) => onChange({ ...value, [id]: !value[id] });
  const allOn = required.every((r) => value[r.id]);

  const stampAll = () => {
    // Cascade — stamp each in sequence for delight
    let next = { ...value };
    required.forEach((r, i) => {
      setTimeout(() => {
        next = { ...next, [r.id]: true };
        onChange(next);
      }, i * 130);
    });
  };

  return (
    <div className="stage" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 580 }}>
      <header style={{ '--ed-index': 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Caption>Step 01 · Before we start</Caption>
        <h2 className="editorial-headline" style={{ fontSize: 'clamp(32px, 4vw, 44px)', margin: 0 }}>
          The honest fine print.
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
          Smoke Ledger is cessation support software — not medical treatment or emergency care.
        </p>
      </header>

      <div
        className="rule-draw"
        style={{ '--ed-index': 1, borderTop: '1px solid var(--rule-strong)', width: 60 }}
      />

      <div style={{ '--ed-index': 2, display: 'flex', flexDirection: 'column' }}>
        {required.map((r, i) => (
          <label
            key={r.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              padding: '14px 0',
              borderBottom: '1px solid var(--rule)',
              cursor: 'pointer',
              transition: 'background 160ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(47,163,155,0.03)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <input
              type="checkbox"
              className="ed-checkbox focus-ring"
              checked={!!value[r.id]}
              onChange={() => toggle(r.id)}
              style={{ marginTop: 2 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                {r.label.includes('Terms') ? (
                  <>
                    I agree to the{' '}
                    <span style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                      Terms of Service
                    </span>
                    .
                  </>
                ) : r.label.includes('Privacy') ? (
                  <>
                    I acknowledge the{' '}
                    <span style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                      Privacy Policy
                    </span>
                    .
                  </>
                ) : (
                  r.label
                )}
              </span>
              {r.sub && (
                <span style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>{r.sub}</span>
              )}
            </div>

            {/* Stamp slot — appears when checked */}
            <div style={{ minWidth: 78, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minHeight: 22 }}>
              <Stamp show={!!value[r.id]} color="var(--accent)" rotate={-6 + (i % 2 === 0 ? -2 : 3)}>
                Acknowledged
              </Stamp>
            </div>

            <span
              className="editorial-caption-tight nums-tabular"
              style={{
                color: value[r.id] ? 'var(--accent)' : 'var(--text-faint)',
                marginTop: 4,
                minWidth: 22,
                textAlign: 'right',
                transition: 'color 200ms',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
          </label>
        ))}

        {/* Optional analytics */}
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            padding: '14px 0',
            cursor: 'pointer',
            opacity: 0.85,
          }}
        >
          <input
            type="checkbox"
            className="ed-checkbox focus-ring"
            checked={!!value.analytics}
            onChange={() => toggle('analytics')}
            style={{ marginTop: 2 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
              <em style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>
                Optional
              </em>{' '}
              — allow first-party product analytics to help improve reliability.
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>
              No third-party trackers, ever.
            </span>
          </div>
        </label>
      </div>

      <div
        style={{
          '--ed-index': 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
          gap: 16,
        }}
      >
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            onClick={stampAll}
            disabled={allOn}
            className="focus-ring"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: allOn ? 'default' : 'pointer',
              fontSize: 12,
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              color: allOn ? 'var(--text-faint)' : 'var(--accent)',
              textDecoration: allOn ? 'none' : 'underline',
              textUnderlineOffset: 4,
              padding: 0,
              opacity: allOn ? 0.5 : 1,
              transition: 'all 200ms',
            }}
            aria-label="Stamp all consents"
          >
            {allOn ? 'all acknowledged' : 'stamp all'}
          </button>
          <span
            className="editorial-caption-tight nums-tabular"
            style={{ color: allOn ? 'var(--accent)' : 'var(--text-faint)', transition: 'color 200ms' }}
          >
            {Object.values(value).filter(Boolean).length} / {required.length + 1} acknowledged
          </span>
          <Button onClick={onContinue} disabled={!canContinue}>
            Continue →
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   STEP 2 — BASELINE
   ────────────────────────────────────────────────────────────────────── */

function StepBaseline({ value, onChange, onContinue, onBack }) {
  const { perDay, window: win, pref } = value;
  const set = (patch) => onChange({ ...value, ...patch });
  const n = Math.max(0, Math.min(40, Number(perDay) || 0));

  // Editorial visualization: subtle grid of marks representing sticks/day
  const marks = useMemo(() => Array.from({ length: 40 }, (_, i) => i < n), [n]);

  // Spend math (rough — ₹18/stick)
  const pricePerStick = 18;
  const dailySpend = n * pricePerStick;
  const yearlySpend = dailySpend * 365;

  const canContinue = perDay !== '' && pref != null;

  return (
    <div className="stage" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      <header style={{ '--ed-index': 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Caption>Step 02 · The baseline</Caption>
        <h2 className="editorial-headline" style={{ fontSize: 'clamp(32px, 4vw, 44px)', margin: 0 }}>
          About how many a day?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, maxWidth: 480 }}>
          One number is plenty. We&rsquo;ll use it for trends and savings — never to judge you.
        </p>
      </header>

      {/* Big editorial numeral display */}
      <div
        style={{
          '--ed-index': 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          alignItems: 'end',
          padding: '24px 0',
          borderTop: '1px solid var(--rule-strong)',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Caption>Sticks per day</Caption>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              className="editorial-numeral nums-tabular"
              style={{ fontSize: 'clamp(72px, 11vw, 128px)', color: 'var(--text)' }}
            >
              <DigitRoll value={n} />
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>per day</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Caption>That&rsquo;s about</Caption>
          <div className="nums-tabular" style={{ fontSize: 22, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
            ₹<DigitRoll value={dailySpend.toLocaleString('en-IN')} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 6 }}>/ day</span>
          </div>
          <div className="nums-tabular" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            ≈ ₹<DigitRoll value={yearlySpend.toLocaleString('en-IN')} /> a year{' '}
            <span style={{ color: 'var(--text-faint)' }}>· at ₹18/stick</span>
          </div>
        </div>
      </div>

      {/* Slider with visual mark strip */}
      <div style={{ '--ed-index': 2, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="focus-ring"
            onClick={() => set({ perDay: String(Math.max(0, n - 1)) })}
            style={{
              width: 36, height: 36, borderRadius: 999, border: '1px solid var(--rule)',
              background: 'var(--bg-elevated)', cursor: 'pointer', fontSize: 18,
              color: 'var(--text-muted)',
              transition: 'all 160ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--rule)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            aria-label="Decrease"
          >−</button>
          <input
            type="range"
            min={0}
            max={40}
            value={n}
            onChange={(e) => set({ perDay: e.target.value })}
            className="brand-range focus-ring"
            style={{ flex: 1 }}
            aria-label="Sticks per day"
          />
          <button
            type="button"
            className="focus-ring"
            onClick={() => set({ perDay: String(Math.min(40, n + 1)) })}
            style={{
              width: 36, height: 36, borderRadius: 999, border: '1px solid var(--rule)',
              background: 'var(--bg-elevated)', cursor: 'pointer', fontSize: 18,
              color: 'var(--text-muted)',
              transition: 'all 160ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--rule)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            aria-label="Increase"
          >+</button>
        </div>

        {/* Mark strip — 40 small ticks, filled up to n, with 3D wave */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(40, 1fr)',
            gap: 3,
            alignItems: 'end',
            height: 32,
            perspective: 400,
          }}
          aria-hidden
        >
          {marks.map((on, i) => {
            const isMilestone = i % 5 === 4;
            return (
              <div
                key={i}
                style={{
                  height: on ? (isMilestone ? 24 : 14) : 4,
                  background: on
                    ? `linear-gradient(to top, var(--accent), color-mix(in oklab, var(--accent) 70%, white))`
                    : 'var(--rule)',
                  opacity: on ? Math.max(0.55, 1 - i * 0.012) : 0.7,
                  borderRadius: 1,
                  transform: on ? `translateZ(${i * 0.6}px)` : 'translateZ(0)',
                  transformStyle: 'preserve-3d',
                  transition:
                    'height 360ms cubic-bezier(0.34, 1.56, 0.64, 1), background 140ms, opacity 200ms, transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transitionDelay: `${i * 8}ms`,
                  boxShadow: on ? '0 1px 0 rgba(47,163,155,0.15)' : 'none',
                }}
              />
            );
          })}
        </div>

        <div className="nums-tabular" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-faint)' }}>
          <span>0</span>
          <span>10</span>
          <span>20</span>
          <span>30</span>
          <span>40+</span>
        </div>
      </div>

      {/* Comparison window */}
      <div style={{ '--ed-index': 3, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Caption>Compare progress over</Caption>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 7, label: '7 days', sub: 'Tight cycle' },
            { id: 30, label: '30 days', sub: 'Smoother trend' },
          ].map((opt) => {
            const selected = win === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => set({ window: opt.id })}
                className="focus-ring"
                style={{
                  flex: 1,
                  textAlign: 'left',
                  padding: '14px 16px',
                  background: selected ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                  border: selected ? '1px solid var(--accent)' : '1px solid var(--rule)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 140ms',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: selected ? 'var(--accent)' : 'var(--text)' }}>
                  {opt.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opt.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Purchase preference */}
      <div style={{ '--ed-index': 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Caption>How do you usually buy?</Caption>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'single', label: 'Mostly singles' },
            { id: 'pack', label: 'Mostly packs' },
            { id: 'mixed', label: 'Mix of both' },
          ].map((opt) => (
            <Chip key={opt.id} selected={pref === opt.id} onClick={() => set({ pref: opt.id })}>
              {opt.label}
            </Chip>
          ))}
        </div>
      </div>

      <div style={{ '--ed-index': 5, display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <Button onClick={onContinue} disabled={!canContinue}>Continue →</Button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   STEP 3 — GOAL
   ────────────────────────────────────────────────────────────────────── */

const GOAL_TYPES = [
  {
    id: 'daily_cap',
    roman: 'I.',
    label: 'Daily cap',
    hint: 'A ceiling — sticks per day',
    example: 'e.g. no more than 8 a day',
    unit: 'sticks / day',
    placeholder: '8',
    defaultTarget: 8,
  },
  {
    id: 'spend_cap_daily',
    roman: 'II.',
    label: 'Spend cap',
    hint: 'A ceiling — rupees per day',
    example: 'e.g. no more than ₹100 a day',
    unit: 'INR / day',
    placeholder: '100',
    defaultTarget: 100,
    prefix: '₹',
  },
  {
    id: 'reduction_target',
    roman: 'III.',
    label: 'Reduction target',
    hint: 'A direction — percent below baseline',
    example: 'e.g. 20% less than I do now',
    unit: '% below baseline',
    placeholder: '20',
    defaultTarget: 20,
  },
  {
    id: 'no_smoke_window',
    roman: 'IV.',
    label: 'No-smoke window',
    hint: 'Protected hours each day',
    example: 'e.g. nothing in the first 4 hours after waking',
    unit: 'hours protected',
    placeholder: '4',
    defaultTarget: 4,
  },
];

function StepGoal({ value, onChange, onContinue, onBack, onSkip }) {
  const { type, target } = value;
  const goal = GOAL_TYPES.find((g) => g.id === type);
  const canContinue = type != null && target !== '' && Number(target) > 0;

  return (
    <div className="stage" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
      <header style={{ '--ed-index': 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Caption>Step 03 · A small goal</Caption>
        <h2 className="editorial-headline" style={{ fontSize: 'clamp(32px, 4vw, 44px)', margin: 0 }}>
          Pick one small goal.
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, maxWidth: 500 }}>
          Small and specific is easier to sustain than ambitious. You can change this or add more later.
        </p>
      </header>

      <div
        style={{
          '--ed-index': 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
          perspective: 1200,
          transformStyle: 'preserve-3d',
        }}
      >
        {GOAL_TYPES.map((g, i) => {
          const selected = type === g.id;
          return (
            <TiltCard
              key={g.id}
              max={selected ? 4 : 9}
              lift={selected ? 18 : 12}
              glare
              onClick={() => onChange({ type: g.id, target: String(g.defaultTarget) })}
              ariaLabel={`Choose ${g.label}`}
              style={{
                textAlign: 'left',
                padding: '22px 22px',
                background: selected ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                border: selected ? '1px solid var(--accent)' : '1px solid var(--rule)',
                borderRadius: 14,
                transition: 'background 200ms, border-color 200ms',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                position: 'relative',
                minHeight: 150,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span
                    className="editorial-numeral"
                    style={{
                      fontSize: 28,
                      color: selected ? 'var(--accent)' : 'var(--text-faint)',
                      fontStyle: 'italic',
                      lineHeight: 1,
                      transition: 'color 240ms, transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                      transform: selected ? 'scale(1.15) translateZ(20px)' : 'scale(1)',
                      display: 'inline-block',
                    }}
                  >
                    {g.roman}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: selected ? 'var(--accent)' : 'var(--text)' }}>
                    {g.label}
                  </span>
                </div>

                <span
                  aria-hidden
                  style={{
                    width: 16, height: 16,
                    borderRadius: 999,
                    border: selected ? 'none' : '1.5px solid var(--rule-strong)',
                    background: selected ? 'var(--accent)' : 'transparent',
                    transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: selected ? 'scale(1.1)' : 'scale(1)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 11,
                  }}
                >
                  {selected ? '✓' : null}
                </span>
              </div>

              <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{g.hint}</span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-faint)',
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  marginTop: 'auto',
                }}
              >
                {g.example}
              </span>
            </TiltCard>
          );
        })}
      </div>

      {goal && (
        <div
          className="fade-in"
          style={{
            '--ed-index': 2,
            padding: '20px 22px',
            border: '1px solid var(--rule)',
            borderRadius: 12,
            background: 'var(--bg-elevated)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Caption>Target</Caption>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
              {goal.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            {goal.prefix && (
              <span className="editorial-numeral" style={{ fontSize: 40, color: 'var(--text-muted)' }}>
                {goal.prefix}
              </span>
            )}
            <input
              autoFocus
              type="number"
              min={1}
              value={target}
              onChange={(e) => onChange({ ...value, target: e.target.value })}
              placeholder={goal.placeholder}
              className="editorial-numeral nums-tabular focus-ring"
              style={{
                fontSize: 56,
                color: 'var(--text)',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                width: 200,
                padding: 0,
                fontFamily: 'var(--font-display)',
              }}
            />
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{goal.unit}</span>
          </div>
        </div>
      )}

      <div style={{ '--ed-index': 3, display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" onClick={onSkip}>Skip for now</Button>
          <Button onClick={onContinue} disabled={!canContinue}>Continue →</Button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   STEP 4 — BRANDS
   ────────────────────────────────────────────────────────────────────── */

const BRAND_DB = [
  // budget
  { name: 'Capstan', category: 'budget' },
  { name: 'Bristol', category: 'budget' },
  { name: 'Cavanders', category: 'budget' },
  { name: 'Red & White', category: 'budget' },
  { name: 'Four Square', category: 'budget' },
  // regular
  { name: 'Gold Flake', category: 'regular' },
  { name: 'Wills', category: 'regular' },
  { name: 'Navy Cut', category: 'regular' },
  { name: 'Classic', category: 'regular' },
  { name: 'Bharat Bidi', category: 'regular' },
  { name: 'Flake Kings', category: 'regular' },
  // premium
  { name: 'Marlboro', category: 'premium' },
  { name: 'Camel', category: 'premium' },
  { name: 'Benson & Hedges', category: 'premium' },
  { name: 'Dunhill', category: 'premium' },
  // imported
  { name: 'Parliament', category: 'imported' },
  { name: 'Kent', category: 'imported' },
  { name: 'Winston', category: 'imported' },
  { name: 'Lucky Strike', category: 'imported' },
  { name: 'Esse', category: 'imported' },
];

function StepBrands({ value, onChange, onContinue, onBack }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [lastToggled, setLastToggled] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BRAND_DB.filter((b) => {
      if (category !== 'all' && b.category !== category) return false;
      if (!q) return true;
      return b.name.toLowerCase().includes(q);
    });
  }, [query, category]);

  const toggle = (name) => {
    const next = new Set(value.favorites);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange({ favorites: [...next] });
    setLastToggled({ name, t: Date.now() });
  };

  const count = value.favorites.length;

  return (
    <div className="stage" style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 720 }}>
      <header style={{ '--ed-index': 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Caption>Step 04 · Favorites</Caption>
        <h2 className="editorial-headline" style={{ fontSize: 'clamp(32px, 4vw, 44px)', margin: 0 }}>
          Pick a few brands for one-tap logging.
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, maxWidth: 500 }}>
          Two or three is enough — you can always add more from Settings. Don&rsquo;t see yours? Add a
          custom one later.
        </p>
      </header>

      {/* Search + category */}
      <div style={{ '--ed-index': 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="Search Gold Flake, Marlboro…"
          leftAdornment={<SearchIcon />}
          rightAdornment={
            query && (
              <button
                onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}
              >
                clear
              </button>
            )
          }
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'budget', label: 'Budget' },
            { id: 'regular', label: 'Regular' },
            { id: 'premium', label: 'Premium' },
            { id: 'imported', label: 'Imported' },
          ].map((c) => (
            <Chip key={c.id} size="sm" selected={category === c.id} onClick={() => setCategory(c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Editorial table-style brand list */}
      <div
        style={{
          '--ed-index': 2,
          borderTop: '1px solid var(--rule-strong)',
          borderBottom: '1px solid var(--rule)',
          maxHeight: 280,
          overflowY: 'auto',
        }}
        className="scroll-clean"
      >
        {filtered.length === 0 ? (
          <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No brands match. You can add custom brands in Settings.
          </div>
        ) : (
          filtered.map((b, i) => {
            const selected = value.favorites.includes(b.name);
            const justToggled = lastToggled && lastToggled.name === b.name;
            return (
              <button
                key={b.name}
                type="button"
                onClick={() => toggle(b.name)}
                className="focus-ring"
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr auto auto auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 4px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--rule)' : 'none',
                  background: selected ? 'var(--accent-soft)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 180ms',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.background = 'rgba(47,163,155,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  className="editorial-caption-tight nums-tabular"
                  style={{ color: selected ? 'var(--accent)' : 'var(--text-faint)', paddingLeft: 8 }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 15, color: 'var(--text)', fontWeight: selected ? 600 : 500 }}>
                  {b.name}
                </span>
                {/* Stamp slot — animated on toggle */}
                <span style={{ minWidth: 60, display: 'flex', justifyContent: 'flex-end' }}>
                  {selected && (
                    <Stamp
                      show
                      key={justToggled ? lastToggled.t : `stamp-${b.name}`}
                      color="var(--accent)"
                      rotate={-8}
                    >
                      Favorite
                    </Stamp>
                  )}
                </span>
                <span
                  className="editorial-caption-tight"
                  style={{ color: 'var(--text-faint)', minWidth: 60, textAlign: 'right' }}
                >
                  {b.category}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    border: selected ? 'none' : '1px solid var(--rule-strong)',
                    background: selected ? 'var(--accent)' : 'transparent',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    marginRight: 8,
                    transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: selected ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  {selected ? '✓' : <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>+</span>}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Selected pile */}
      {count > 0 && (
        <div className="fade-in" style={{ '--ed-index': 3, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Caption>
            <DigitRoll value={count} /> selected
          </Caption>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {value.favorites.map((name, idx) => (
              <button
                key={name}
                type="button"
                onClick={() => toggle(name)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 30,
                  padding: '0 10px 0 12px',
                  borderRadius: 999,
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  animation: 'chipPopIn 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
                  animationDelay: `${idx * 40}ms`,
                  boxShadow: '0 4px 12px -4px rgba(47, 163, 155, 0.45)',
                  transition: 'transform 120ms, box-shadow 200ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 18px -4px rgba(47, 163, 155, 0.55)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px -4px rgba(47, 163, 155, 0.45)';
                }}
              >
                {name} <span style={{ opacity: 0.7, fontSize: 14 }}>×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ '--ed-index': 4, display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <Button onClick={onContinue} disabled={count === 0}>
          Finish setup →
        </Button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   STEP 5 — DONE
   Editorial summary spread + ledger receipt
   ────────────────────────────────────────────────────────────────────── */

function StepDone({ state, onRestart, onOpenDashboard }) {
  const goal = GOAL_TYPES.find((g) => g.id === state.goal.type);
  const baseline = Number(state.baseline.perDay) || 0;
  const pricePerStick = 18;
  const yearlySpend = baseline * pricePerStick * 365;

  const today = new Date();
  const dateLine = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Trigger receipt print-on animation
  const [printed, setPrinted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPrinted(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="stage" style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 680 }}>
      <header style={{ '--ed-index': 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Caption>The ledger is open · {dateLine}</Caption>
        <h2 className="editorial-headline" style={{ fontSize: 'clamp(36px, 5vw, 56px)', margin: 0 }}>
          You&rsquo;re set up.
          <br />
          <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>One stick at a time.</span>
        </h2>
      </header>

      <div
        className="rule-draw"
        style={{ '--ed-index': 1, borderTop: '1px solid var(--rule-strong)', width: 80 }}
      />

      {/* Receipt — prints in from top with clip-path reveal */}
      <div style={{ '--ed-index': 2, position: 'relative' }}>
        <div
          style={{
            position: 'relative',
            padding: '32px 28px 28px 28px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--rule)',
            borderRadius: 4,
            overflow: 'visible',
            boxShadow: printed
              ? '0 24px 60px -20px rgba(11,15,20,0.18), 0 4px 12px rgba(11,15,20,0.06), inset 0 0 0 1px rgba(255,255,255,0.4)'
              : '0 0 0 transparent',
            clipPath: printed ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
            transition: 'clip-path 1100ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 600ms ease-out',
            transformOrigin: 'top center',
          }}
        >
          {/* Torn-paper top edge */}
          <PaperEdge side="top" color="var(--bg)" />

          {/* Paper noise layer */}
          <div
            className="paper-noise"
            style={{ position: 'absolute', inset: 0, borderRadius: 4 }}
            aria-hidden
          />

          {/* Wax seal — top-right */}
          <div style={{ position: 'absolute', top: -28, right: 24, zIndex: 2 }}>
            <SealCircle show={printed} size={96} label="SMOKE · LEDGER · " />
          </div>

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Caption>Your setup</Caption>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontStyle: 'italic',
                    fontSize: 14,
                    color: 'var(--text-muted)',
                  }}
                >
                  Filed {today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <span className="editorial-caption-tight nums-tabular" style={{ color: 'var(--text-faint)' }}>
                No. <DigitRoll value="0001" delay={400} />
              </span>
            </div>

            <Hairline strong />

            <SummaryRow
              label="Baseline"
              value={
                <span className="nums-tabular">
                  <DigitRoll value={baseline} delay={500} />{' '}
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>sticks / day</span>
                </span>
              }
              sub={`Compared over ${state.baseline.window} days · ${
                state.baseline.pref === 'single' ? 'mostly singles' :
                state.baseline.pref === 'pack' ? 'mostly packs' : 'mixed'
              }`}
            />
            <Hairline />

            <SummaryRow
              label="Goal"
              value={
                state.goal.type ? (
                  <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                    {goal.label} ·{' '}
                    <span className="nums-tabular" style={{ fontStyle: 'normal' }}>
                      {goal.prefix}
                      <DigitRoll value={state.goal.target} delay={700} />
                    </span>{' '}
                    <span style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'normal' }}>
                      {goal.unit}
                    </span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>
                    Skipped — that&rsquo;s fine
                  </span>
                )
              }
            />
            <Hairline />

            <SummaryRow
              label="Favorites"
              value={
                <span style={{ fontSize: 14 }}>
                  <DigitRoll value={state.brands.favorites.length} delay={900} /> brand
                  {state.brands.favorites.length === 1 ? '' : 's'}
                </span>
              }
              sub={state.brands.favorites.slice(0, 4).join(' · ') + (state.brands.favorites.length > 4 ? ' …' : '')}
            />
            <Hairline />

            <SummaryRow
              label="At this rate"
              value={
                <span className="nums-tabular" style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>
                  ₹<DigitRoll value={yearlySpend.toLocaleString('en-IN')} delay={1100} />
                </span>
              }
              sub="Annual spend on cigarettes at current baseline."
              accent
            />
          </div>

          {/* Bottom perforation */}
          <PaperEdge side="bottom" color="var(--bg)" />
        </div>
      </div>

      {/* Quiet footer note + CTAs */}
      <div style={{ '--ed-index': 3, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: 'var(--text-muted)',
            lineHeight: 1.55,
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            maxWidth: 520,
          }}
        >
          &ldquo;Awareness is the first move. Nothing to prove today — just observe, log, learn.&rdquo;
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={onOpenDashboard}
            className="focus-ring"
            style={{
              height: 52,
              padding: '0 24px',
              border: 'none',
              cursor: 'pointer',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 10,
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 12px 32px -8px rgba(47, 163, 155, 0.45), 0 2px 4px rgba(11, 15, 20, 0.08)',
              transition: 'transform 120ms, box-shadow 200ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 16px 40px -8px rgba(47, 163, 155, 0.55), 0 4px 8px rgba(11, 15, 20, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 12px 32px -8px rgba(47, 163, 155, 0.45), 0 2px 4px rgba(11, 15, 20, 0.08)';
            }}
          >
            Open the dashboard
            <span aria-hidden style={{ fontSize: 16 }}>→</span>
          </button>
          <Button variant="ghost" onClick={onRestart}>Restart tour</Button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, sub, accent }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, alignItems: 'baseline' }}>
      <span className="editorial-caption-tight">{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 17, color: accent ? 'var(--accent)' : 'var(--text)' }}>{value}</span>
        {sub && <span style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>{sub}</span>}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   ICONS
   ────────────────────────────────────────────────────────────────────── */

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="9" r="6" />
      <path d="M14 14 L18 18" strokeLinecap="round" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   EXPORTS
   ────────────────────────────────────────────────────────────────────── */

Object.assign(window, {
  StepWelcome,
  StepPrivacy,
  StepBaseline,
  StepGoal,
  StepBrands,
  StepDone,
  Button,
  Chip,
  Caption,
  Hairline,
  GOAL_TYPES,
});
