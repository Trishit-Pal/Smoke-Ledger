// onboarding-app.jsx
// Main shell — browser frame, layout variant switcher, progress rail, state machine, tweaks panel.

const { useState, useEffect, useMemo, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "layout": "editorial",
  "density": "cozy",
  "displayFont": "Fraunces"
}/*EDITMODE-END*/;

const FONT_STACKS = {
  Fraunces: "'Fraunces', Georgia, serif",
  'Playfair Display': "'Playfair Display', Georgia, serif",
  'Cormorant Garamond': "'Cormorant Garamond', Georgia, serif",
  'IBM Plex Serif': "'IBM Plex Serif', Georgia, serif",
};

const STEPS = [
  { id: 'welcome',  short: 'Welcome',   title: 'Welcome' },
  { id: 'privacy',  short: 'Consent',   title: 'Before we start' },
  { id: 'baseline', short: 'Baseline',  title: 'Your daily baseline' },
  { id: 'goal',     short: 'Goal',      title: 'Pick one small goal' },
  { id: 'brands',   short: 'Brands',    title: 'Favorite brands' },
  { id: 'done',     short: 'Done',      title: 'All set' },
];

/* ─── Logo ──────────────────────────────────────────────────────────── */

function Wordmark({ small }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        aria-hidden
        style={{
          width: small ? 18 : 22,
          height: small ? 18 : 22,
          borderRadius: 999,
          border: '1.5px solid var(--accent)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <span
          style={{
            width: small ? 8 : 10,
            height: 2,
            background: 'var(--accent)',
            borderRadius: 1,
          }}
        />
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontStyle: 'italic',
          fontSize: small ? 14 : 17,
          letterSpacing: '-0.01em',
          color: 'var(--text)',
        }}
      >
        Smoke Ledger
      </span>
    </div>
  );
}

/* ─── Theme toggle (in-design, not just Tweaks) ─────────────────────── */

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      className="focus-ring"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        position: 'relative',
        width: 64,
        height: 32,
        borderRadius: 999,
        border: '1px solid var(--rule)',
        background: isDark ? 'var(--ink-surface)' : 'var(--bg-elevated)',
        cursor: 'pointer',
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'background 240ms ease, border-color 240ms ease',
      }}
    >
      {/* Sun icon */}
      <span
        aria-hidden
        style={{
          width: 32,
          height: 32,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isDark ? 'var(--ink-surface-muted)' : 'var(--accent)',
          fontSize: 12,
          transition: 'color 240ms',
        }}
      >
        <SunGlyph />
      </span>
      {/* Moon icon */}
      <span
        aria-hidden
        style={{
          width: 32,
          height: 32,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isDark ? 'var(--ink-surface-text)' : 'var(--text-faint)',
          fontSize: 12,
          transition: 'color 240ms',
        }}
      >
        <MoonGlyph />
      </span>
      {/* Sliding pill */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 3,
          left: isDark ? 'calc(100% - 27px)' : 3,
          width: 24,
          height: 24,
          borderRadius: 999,
          background: isDark ? '#E6EAEF' : 'var(--accent)',
          boxShadow: isDark
            ? '0 4px 10px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.1)'
            : '0 4px 10px rgba(47,163,155,0.35)',
          transition:
            'left 320ms cubic-bezier(0.34, 1.56, 0.64, 1), background 240ms',
        }}
      />
    </button>
  );
}

function SunGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
    </svg>
  );
}
function MoonGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

/* ─── Editorial Sidebar (layout: editorial) ──────────────────────────── */

function EditorialRail({ stepIndex, onJump, theme, onToggleTheme }) {
  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        borderRight: '1px solid var(--rule)',
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 36,
        position: 'relative',
        background: 'var(--bg)',
      }}
    >
      {/* Masthead with paper noise */}
      <div style={{ position: 'relative' }}>
        <div className="paper-noise" style={{ position: 'absolute', inset: '-32px -28px 0 -28px', height: 140 }} aria-hidden />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Wordmark />
            <span className="editorial-caption-tight" style={{ color: 'var(--text-faint)' }}>
              Vol. I · Onboarding
            </span>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>

      {/* Step list */}
      <nav style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="editorial-caption-tight" style={{ marginBottom: 14, color: 'var(--text-faint)' }}>
          The setup
        </span>
        <div style={{ borderTop: '1px solid var(--rule-strong)' }} />
        {STEPS.slice(0, STEPS.length - 1).map((s, i) => {
          const isCurrent = i === stepIndex;
          const isDone = i < stepIndex;
          const isReachable = i <= stepIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => isReachable && onJump(i)}
              disabled={!isReachable}
              className="focus-ring"
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr auto',
                alignItems: 'baseline',
                gap: 10,
                padding: '14px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--rule)',
                cursor: isReachable ? 'pointer' : 'not-allowed',
                textAlign: 'left',
                opacity: isReachable ? 1 : 0.5,
                transition: 'all 140ms',
              }}
            >
              <span
                className="editorial-numeral nums-tabular"
                style={{
                  fontSize: 22,
                  color: isCurrent ? 'var(--accent)' : isDone ? 'var(--text-muted)' : 'var(--text-faint)',
                  lineHeight: 1,
                }}
              >
                {String(i).padStart(2, '0')}
              </span>
              <span
                style={{
                  fontSize: 15,
                  color: isCurrent ? 'var(--text)' : 'var(--text-muted)',
                  fontWeight: isCurrent ? 600 : 500,
                  fontFamily: isCurrent ? 'var(--font-display)' : 'var(--font-sans)',
                  fontStyle: isCurrent ? 'italic' : 'normal',
                }}
              >
                {s.short}
              </span>
              <span style={{ fontSize: 11, color: isDone ? 'var(--accent)' : 'var(--text-faint)' }}>
                {isDone ? '●' : isCurrent ? '◐' : '○'}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom quietness */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ borderTop: '1px solid var(--rule)' }} />
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--text-muted)',
            margin: 0,
          }}
        >
          &ldquo;The body is more honest than the calendar. Listen first; count second.&rdquo;
        </p>
        <span className="editorial-caption-tight" style={{ color: 'var(--text-faint)' }}>
          — Editor&rsquo;s note
        </span>
      </div>
    </aside>
  );
}

/* ─── Traditional Top Bar (layout: traditional) ──────────────────────── */

function TraditionalTopBar({ stepIndex, onJump, theme, onToggleTheme }) {
  const total = STEPS.length - 1;
  const progress = Math.min(stepIndex, total) / (total - 1);
  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        padding: '18px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Wordmark small />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Step {Math.min(stepIndex + 1, total)} of {total}
          </span>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {STEPS.slice(0, STEPS.length - 1).map((s, i) => {
          const isCurrent = i === stepIndex;
          const isDone = i < stepIndex;
          const isReachable = i <= stepIndex;
          return (
            <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => isReachable && onJump(i)}
                disabled={!isReachable}
                className="focus-ring"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'transparent',
                  border: 'none',
                  cursor: isReachable ? 'pointer' : 'not-allowed',
                  padding: 0,
                  fontSize: 12,
                  color: isCurrent ? 'var(--accent)' : isDone ? 'var(--text)' : 'var(--text-faint)',
                  fontWeight: isCurrent ? 600 : 500,
                }}
              >
                <span
                  style={{
                    width: 22, height: 22, borderRadius: 999,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: isCurrent ? 'var(--accent)' : isDone ? 'var(--accent-soft)' : 'var(--bg)',
                    color: isCurrent ? '#fff' : isDone ? 'var(--accent)' : 'var(--text-faint)',
                    border: isCurrent ? 'none' : '1px solid var(--rule)',
                    fontSize: 11, fontWeight: 700,
                  }}
                >
                  {isDone ? '✓' : i + 1}
                </span>
                <span>{s.short}</span>
              </button>
              {i < total - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: i < stepIndex ? 'var(--accent)' : 'var(--rule)',
                    transition: 'background 240ms',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Step body wrapper (handles transitions) ───────────────────────── */

function StepStage({ children, stepKey }) {
  const [activeKey, setActiveKey] = useState(stepKey);
  const [phase, setPhase] = useState('in');

  useEffect(() => {
    if (stepKey !== activeKey) {
      setPhase('out');
      const t = setTimeout(() => {
        setActiveKey(stepKey);
        setPhase('in');
      }, 220);
      return () => clearTimeout(t);
    }
  }, [stepKey, activeKey]);

  return (
    <div
      key={activeKey}
      style={{
        opacity: phase === 'in' ? 1 : 0,
        transform: phase === 'in' ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 220ms ease, transform 220ms ease',
      }}
    >
      {children}
    </div>
  );
}

/* ─── Step body content area ────────────────────────────────────────── */

function StepBody({ stepIndex, total, children, layout }) {
  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: layout === 'editorial' ? '40px 56px 64px 56px' : '32px 40px 56px 40px',
        position: 'relative',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
      className="scroll-clean"
    >
      {/* Step counter in corner — editorial only */}
      {layout === 'editorial' && (
        <div
          style={{
            position: 'absolute',
            top: 24,
            right: 32,
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            color: 'var(--text-faint)',
          }}
        >
          <span
            className="editorial-numeral nums-tabular"
            style={{ fontSize: 28, fontStyle: 'italic', lineHeight: 1 }}
          >
            {String(stepIndex).padStart(2, '0')}
          </span>
          <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            / {String(total).padStart(2, '0')}
          </span>
        </div>
      )}

      {children}
    </div>
  );
}

/* ─── Phantom dashboard preview after onboarding ────────────────────── */

function DashboardPreview({ state }) {
  const baseline = Number(state.baseline.perDay) || 0;
  const sticksToday = Math.min(baseline + 1, Math.max(0, Math.round(baseline * 0.7))) || 3;
  const goal = GOAL_TYPES.find((g) => g.id === state.goal.type);
  const today = new Date();

  return (
    <div
      className="stage"
      style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 760 }}
    >
      <header style={{ '--ed-index': 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Caption>
          {today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} ·
          Dashboard preview
        </Caption>
        <h2 className="editorial-headline" style={{ fontSize: 'clamp(28px, 3.5vw, 38px)', margin: 0 }}>
          Today, in quiet figures.
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
          This is what your home will look like. Logging takes a single tap.
        </p>
      </header>

      <div
        style={{
          '--ed-index': 1,
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 32,
          paddingTop: 24,
          paddingBottom: 24,
          borderTop: '1px solid var(--rule-strong)',
          borderBottom: '1px solid var(--rule)',
          alignItems: 'end',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Caption>Sticks today</Caption>
          <div className="editorial-numeral nums-tabular" style={{ fontSize: 'clamp(80px, 14vw, 144px)' }}>
            {sticksToday}
          </div>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 16,
              color: 'var(--text-muted)',
            }}
          >
            {sticksToday < baseline
              ? `${baseline - sticksToday} under baseline.`
              : 'On baseline so far.'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Caption>This week</Caption>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, alignItems: 'end', height: 70 }}>
            {[6, 8, 5, 7, 4, 6, sticksToday].map((v, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: '100%',
                    height: `${(v / 12) * 60}px`,
                    background: i === 6 ? 'var(--accent)' : 'var(--rule-strong)',
                    borderRadius: 2,
                    transition: 'height 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                    transitionDelay: `${i * 60 + 200}ms`,
                  }}
                />
                <span className="editorial-caption-tight nums-tabular" style={{ fontSize: 10 }}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ '--ed-index': 2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        <SmallStat label="Spend, today" value={`₹${(sticksToday * 18).toLocaleString('en-IN')}`} sub="@ ₹18 / stick" />
        <SmallStat
          label="Goal"
          value={goal ? `${goal.prefix || ''}${state.goal.target}` : '—'}
          sub={goal ? goal.unit : 'none set'}
          accent={!!goal}
        />
        <SmallStat label="Streak" value="0 d" sub="no smoke-free day yet" />
      </div>

      <div style={{ '--ed-index': 3, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Caption>One-tap log</Caption>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {state.brands.favorites.slice(0, 4).map((b) => (
            <button
              key={b}
              style={{
                padding: '14px 18px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--rule)',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 14,
                color: 'var(--text)',
                fontWeight: 500,
                fontFamily: 'var(--font-sans)',
                transition: 'all 140ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.background = 'var(--accent-soft)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--rule)';
                e.currentTarget.style.background = 'var(--bg-elevated)';
              }}
            >
              + {b}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>
          This is a static preview — the real dashboard is interactive.
        </span>
      </div>
    </div>
  );
}

function SmallStat({ label, value, sub, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
      <Caption>{label}</Caption>
      <span
        className="nums-tabular"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 400,
          color: accent ? 'var(--accent)' : 'var(--text)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</span>
    </div>
  );
}

/* ─── Tweaks panel ──────────────────────────────────────────────────── */

function Tweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Theme">
        <TweakRadio
          value={tweaks.theme}
          onChange={(v) => setTweak('theme', v)}
          options={['light', 'dark']}
        />
      </TweakSection>

      <TweakSection title="Layout">
        <TweakRadio
          value={tweaks.layout}
          onChange={(v) => setTweak('layout', v)}
          options={[
            { value: 'editorial', label: 'Editorial' },
            { value: 'traditional', label: 'Traditional' },
          ]}
        />
      </TweakSection>

      <TweakSection title="Density">
        <TweakRadio
          value={tweaks.density}
          onChange={(v) => setTweak('density', v)}
          options={['cozy', 'compact']}
        />
      </TweakSection>

      <TweakSection title="Display font">
        <TweakSelect
          value={tweaks.displayFont}
          onChange={(v) => setTweak('displayFont', v)}
          options={['Fraunces', 'Playfair Display', 'Cormorant Garamond', 'IBM Plex Serif']}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

/* ─── Root App ──────────────────────────────────────────────────────── */

function App() {
  const [tweaks, setTweaksAll] = useTweaks(TWEAK_DEFAULTS);
  const setTweak = (k, v) => setTweaksAll({ [k]: v });

  const [stepIndex, setStepIndex] = useState(0);
  const prevStepIndex = useRef(0);
  const [direction, setDirection] = useState(1);
  const [state, setState] = useState({
    privacy: { age: false, terms: false, privacy: false, medical: false, dataProcessing: false, analytics: false },
    baseline: { perDay: '10', window: 30, pref: null },
    goal: { type: null, target: '' },
    brands: { favorites: [] },
  });

  // Apply theme + font live
  useEffect(() => {
    const root = document.documentElement;
    if (tweaks.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    root.style.setProperty('--font-display', FONT_STACKS[tweaks.displayFont] || FONT_STACKS.Fraunces);
  }, [tweaks.theme, tweaks.displayFont]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || (e.key === 'Enter' && stepIndex === 0)) {
        // only auto-advance on welcome
        if (stepIndex === 0) goTo(1);
      } else if (e.key === 'ArrowLeft') {
        if (stepIndex > 0) goTo(stepIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line
  }, [stepIndex]);

  const goTo = (i) => {
    const target = Math.max(0, Math.min(STEPS.length - 1, i));
    setDirection(target > stepIndex ? 1 : -1);
    prevStepIndex.current = stepIndex;
    setStepIndex(target);
  };

  const toggleTheme = () =>
    setTweak('theme', tweaks.theme === 'dark' ? 'light' : 'dark');

  const step = STEPS[stepIndex];
  const layout = tweaks.layout;
  const density = tweaks.density;

  // Render step content
  const renderStep = () => {
    switch (step.id) {
      case 'welcome':
        return <StepWelcome onContinue={() => goTo(1)} />;
      case 'privacy':
        return (
          <StepPrivacy
            value={state.privacy}
            onChange={(v) => setState((s) => ({ ...s, privacy: v }))}
            onContinue={() => goTo(2)}
            onBack={() => goTo(0)}
          />
        );
      case 'baseline':
        return (
          <StepBaseline
            value={state.baseline}
            onChange={(v) => setState((s) => ({ ...s, baseline: v }))}
            onContinue={() => goTo(3)}
            onBack={() => goTo(1)}
          />
        );
      case 'goal':
        return (
          <StepGoal
            value={state.goal}
            onChange={(v) => setState((s) => ({ ...s, goal: v }))}
            onContinue={() => goTo(4)}
            onBack={() => goTo(2)}
            onSkip={() => {
              setState((s) => ({ ...s, goal: { type: null, target: '' } }));
              goTo(4);
            }}
          />
        );
      case 'brands':
        return (
          <StepBrands
            value={state.brands}
            onChange={(v) => setState((s) => ({ ...s, brands: v }))}
            onContinue={() => goTo(5)}
            onBack={() => goTo(3)}
          />
        );
      case 'done':
        return (
          <StepDone
            state={state}
            onOpenDashboard={() => goTo(6)}
            onRestart={() => {
              setStepIndex(0);
              setState({
                privacy: { age: false, terms: false, privacy: false, medical: false, dataProcessing: false, analytics: false },
                baseline: { perDay: '10', window: 30, pref: null },
                goal: { type: null, target: '' },
                brands: { favorites: [] },
              });
            }}
          />
        );
      default:
        // stepIndex === 6: dashboard preview
        return <DashboardPreview state={state} />;
    }
  };

  return (
    <div
      className={density === 'compact' ? 'density-compact' : ''}
      data-screen-label={`${String(stepIndex).padStart(2, '0')} ${step.short}`}
      style={{ minHeight: '100vh' }}
    >
      <div className="page-host">
        <ChromeWindow
          tabs={[{ title: 'Smoke Ledger — Onboarding' }, { title: 'Privacy Policy' }, { title: 'Support' }]}
          activeIndex={0}
          url="https://smokeledger.app/onboarding"
          width={1200}
          height={780}
        >
          <div
            style={{
              display: 'flex',
              height: '100%',
              flexDirection: layout === 'editorial' ? 'row' : 'column',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontFamily: 'var(--font-sans)',
              position: 'relative',
            }}
          >
            {layout === 'editorial' && stepIndex < STEPS.length - 1 && (
              <EditorialRail
                stepIndex={Math.min(stepIndex, STEPS.length - 2)}
                onJump={(i) => goTo(i)}
                theme={tweaks.theme}
                onToggleTheme={toggleTheme}
              />
            )}
            {layout === 'traditional' && stepIndex < STEPS.length - 1 && (
              <TraditionalTopBar
                stepIndex={Math.min(stepIndex, STEPS.length - 2)}
                onJump={(i) => goTo(i)}
                theme={tweaks.theme}
                onToggleTheme={toggleTheme}
              />
            )}

            {/* Floating toggle for screens without rail/topbar (Done + Dashboard preview) */}
            {stepIndex >= STEPS.length - 1 && (
              <div style={{ position: 'absolute', top: 92, right: 28, zIndex: 5 }}>
                <ThemeToggle theme={tweaks.theme} onToggle={toggleTheme} />
              </div>
            )}

            <StepBody stepIndex={stepIndex} total={STEPS.length - 1} layout={layout}>
              <PageTurn stepKey={`${stepIndex}-${layout}`} direction={direction}>{renderStep()}</PageTurn>
            </StepBody>
          </div>
        </ChromeWindow>
      </div>

      <Tweaks tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
