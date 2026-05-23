// fx.jsx — premium motion + 3D helpers for the Smoke Ledger prototype

const { useState, useEffect, useRef, useMemo, useLayoutEffect } = React;

/* ──────────────────────────────────────────────────────────────────────────
   <DigitRoll value="12,345" /> — odometer-style number with digit-strip roll
   Renders each digit char as a 0-9 vertical strip that translateY to the
   current value. Non-digit chars (₹, commas, decimals) are static.
   ────────────────────────────────────────────────────────────────────── */

function DigitRoll({ value, style, className, delay = 0 }) {
  const chars = String(value).split('');
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        verticalAlign: 'baseline',
        ...style,
      }}
    >
      {chars.map((c, i) =>
        /\d/.test(c) ? (
          <RollDigit key={i} digit={Number(c)} index={i} delay={delay} />
        ) : (
          <span key={i} aria-hidden style={{ display: 'inline-block', lineHeight: 0.9 }}>
            {c}
          </span>
        ),
      )}
    </span>
  );
}

function RollDigit({ digit, index, delay }) {
  return (
    <span
      style={{
        display: 'inline-block',
        height: '0.9em',
        overflow: 'hidden',
        lineHeight: 0.9,
        verticalAlign: 'baseline',
      }}
      aria-hidden
    >
      <span
        style={{
          display: 'block',
          transform: `translateY(-${digit * 0.9}em)`,
          transition: `transform 720ms cubic-bezier(0.16, 1, 0.3, 1)`,
          transitionDelay: `${delay + index * 35}ms`,
          willChange: 'transform',
        }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} style={{ display: 'block', height: '0.9em', lineHeight: 0.9 }}>
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   <TiltCard> — cursor-following 3D tilt with depth shadow.
   Subtle by default — editorial restraint. Adds a soft "lift" on hover.
   ────────────────────────────────────────────────────────────────────── */

function TiltCard({ children, max = 6, lift = 10, glare = false, style, className, onClick, ariaLabel }) {
  const ref = useRef(null);
  const [t, setT] = useState({ x: 0, y: 0, hover: false, px: 0.5, py: 0.5 });
  const reduceMotion = useReduceMotion();

  const onMove = (e) => {
    if (reduceMotion) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setT({ x: -(py - 0.5) * max, y: (px - 0.5) * max, hover: true, px, py });
  };
  const onLeave = () => setT((s) => ({ ...s, x: 0, y: 0, hover: false }));

  return (
    <div
      ref={ref}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick(e) : undefined}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{
        transformStyle: 'preserve-3d',
        transform: `perspective(900px) rotateX(${t.x}deg) rotateY(${t.y}deg) translateZ(${
          t.hover ? lift : 0
        }px)`,
        transition: t.hover
          ? 'transform 90ms ease-out, box-shadow 200ms ease-out'
          : 'transform 480ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 280ms ease-out',
        boxShadow: t.hover
          ? `0 ${20 + lift}px ${30 + lift * 2}px -10px rgba(11, 15, 20, 0.18), 0 4px 12px rgba(11, 15, 20, 0.06)`
          : '0 1px 0 rgba(11, 15, 20, 0.02)',
        cursor: onClick ? 'pointer' : undefined,
        position: 'relative',
        ...style,
      }}
    >
      {children}
      {glare && t.hover && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: 'inherit',
            background: `radial-gradient(circle at ${t.px * 100}% ${t.py * 100}%, rgba(255,255,255,0.18), transparent 50%)`,
            mixBlendMode: 'overlay',
            transition: 'opacity 200ms',
          }}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   <Stamp> — animated rubber-stamp impression.
   Visible: scale 1, rotation ~-6°. Initial: oversized + sharper rotation.
   Use with show toggle; persists when "stamped".
   ────────────────────────────────────────────────────────────────────── */

function Stamp({ show, children, color = 'var(--accent)', rotate = -6, double = true, style }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        border: `1.5px solid ${color}`,
        color,
        padding: '3px 8px',
        fontFamily: 'var(--font-display)',
        fontStyle: 'italic',
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.22em',
        borderRadius: 3,
        boxShadow: double ? `inset 0 0 0 3px var(--bg-elevated), inset 0 0 0 4px ${color}` : 'none',
        opacity: show ? 0.88 : 0,
        transform: show
          ? `scale(1) rotate(${rotate}deg)`
          : 'scale(1.8) rotate(-30deg)',
        transformOrigin: 'center',
        transition: show
          ? 'opacity 240ms ease-out, transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)'
          : 'opacity 180ms, transform 180ms',
        whiteSpace: 'nowrap',
        ...style,
      }}
      aria-hidden
    >
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   <SealCircle> — wax-seal style circular stamp with text on a ring.
   Used on the Done step. Pure CSS + inline SVG; no images.
   ────────────────────────────────────────────────────────────────────── */

function SealCircle({ size = 110, label = 'SMOKE · LEDGER · 2026 · ', show = true }) {
  const id = useMemo(() => 'sealtext-' + Math.random().toString(36).slice(2, 8), []);
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        opacity: show ? 1 : 0,
        transform: show
          ? 'scale(1) rotate(-8deg)'
          : 'scale(1.6) rotate(40deg)',
        transformOrigin: 'center',
        transition: 'opacity 360ms ease-out, transform 520ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        transitionDelay: '600ms',
      }}
      aria-hidden
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <defs>
          <path
            id={id}
            d={`M ${size / 2}, ${size / 2}
                m -${size * 0.36}, 0
                a ${size * 0.36}, ${size * 0.36} 0 1, 1 ${size * 0.72}, 0
                a ${size * 0.36}, ${size * 0.36} 0 1, 1 -${size * 0.72}, 0`}
          />
        </defs>
        {/* Outer ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.45}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
        />
        {/* Inner ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.42}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.75"
          strokeDasharray="2 3"
        />
        {/* Ring text */}
        <text fill="var(--accent)" fontSize={size * 0.085} letterSpacing="2" fontWeight={600}>
          <textPath xlinkHref={`#${id}`} startOffset="0">
            {label}{label}
          </textPath>
        </text>
        {/* Centre glyph */}
        <text
          x={size / 2}
          y={size / 2 + size * 0.06}
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontStyle="italic"
          fontWeight={500}
          fontSize={size * 0.32}
          fill="var(--accent)"
        >
          SL
        </text>
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   <PageTurn> — 3D page-turn transition wrapper.
   When `stepKey` changes, the current page rotates up (rotateX) and the new
   one comes in. Subtle: no full flip.
   ────────────────────────────────────────────────────────────────────── */

function PageTurn({ stepKey, direction = 1, children }) {
  const [active, setActive] = useState(stepKey);
  const [phase, setPhase] = useState('in');
  const reduce = useReduceMotion();

  useEffect(() => {
    if (stepKey === active) return;
    setPhase('out');
    const t = setTimeout(() => {
      setActive(stepKey);
      setPhase('enter');
      requestAnimationFrame(() => setPhase('in'));
    }, reduce ? 0 : 240);
    return () => clearTimeout(t);
  }, [stepKey, active, reduce]);

  const out = phase === 'out';
  const enter = phase === 'enter';

  return (
    <div style={{ perspective: 1400, transformStyle: 'preserve-3d', minHeight: 0 }}>
      <div
        key={active}
        style={{
          opacity: out ? 0 : enter ? 0 : 1,
          transform: out
            ? `rotateX(-6deg) translateY(${-12 * direction}px)`
            : enter
            ? `rotateX(6deg) translateY(${12 * direction}px)`
            : 'rotateX(0deg) translateY(0)',
          transformOrigin: 'top center',
          transition: reduce
            ? 'none'
            : 'opacity 320ms cubic-bezier(0.16, 1, 0.3, 1), transform 360ms cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'opacity, transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   useReduceMotion — respect prefers-reduced-motion
   ────────────────────────────────────────────────────────────────────── */
function useReduceMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setR(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);
  return r;
}

/* ──────────────────────────────────────────────────────────────────────────
   useCountUp — animate from previous value to current value over duration
   ────────────────────────────────────────────────────────────────────── */
function useCountUp(value, duration = 700) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef(performance.now());
  const rafRef = useRef(null);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      // ease out
      const e = 1 - Math.pow(1 - t, 3);
      const v = Math.round(fromRef.current + (value - fromRef.current) * e);
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, [value]);

  return display;
}

/* ──────────────────────────────────────────────────────────────────────────
   <PaperEdge> — torn / perforated top edge for a receipt
   ────────────────────────────────────────────────────────────────────── */
function PaperEdge({ side = 'top', color = 'var(--bg)' }) {
  const teeth = 28;
  const path =
    side === 'top'
      ? 'M0,12 ' +
        Array.from({ length: teeth }, (_, i) => `L${(i + 0.5) * (100 / teeth)},${(i % 2) * 8 + 4}`).join(' ') +
        ' L100,12 L100,0 L0,0 Z'
      : 'M0,0 ' +
        Array.from({ length: teeth }, (_, i) => `L${(i + 0.5) * (100 / teeth)},${(i % 2) * 8 + 4}`).join(' ') +
        ' L100,0 L100,12 L0,12 Z';
  return (
    <svg
      viewBox="0 0 100 12"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        [side]: -1,
        height: 10,
        width: '100%',
        display: 'block',
      }}
    >
      <path d={path} fill={color} />
    </svg>
  );
}

Object.assign(window, {
  DigitRoll,
  TiltCard,
  Stamp,
  SealCircle,
  PageTurn,
  PaperEdge,
  useReduceMotion,
  useCountUp,
});
